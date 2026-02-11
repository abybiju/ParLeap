/**
 * Audio Capture Hook
 * 
 * Captures audio from browser microphone and streams to WebSocket
 * Optimized for speech-to-text (16kHz, mono, WebM Opus)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getWebSocketClient } from '../websocket/client';
import type { AudioDataMessage, SttWindowRequestMessage } from '../websocket/types';

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface AudioCaptureState {
  isRecording: boolean;
  isPaused: boolean;
  permissionState: PermissionState;
  error: string | null;
  audioLevel: number; // 0-100
}

export interface UseAudioCaptureReturn {
  state: AudioCaptureState;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  requestPermission: () => Promise<boolean>;
  /** Smart Bible Listen: open STT window and send ring-buffer catch-up. No-op when not in PCM or smartListenEnabled. */
  requestSttWindow?: () => void;
}

export interface AudioCaptureOptions {
  usePcm?: boolean;
  sessionActive?: boolean; // Only send audio when session is active
  /** When true (and usePcm), audio is buffered until requestSttWindow() is called; then catch-up + live stream sent. */
  smartListenEnabled?: boolean;
  /** Ring buffer length in ms (default 10000). Only used when smartListenEnabled. */
  smartListenBufferMs?: number;
}

/**
 * Audio capture hook with MediaRecorder API
 * 
 * Features:
 * - Automatic permission handling
 * - Audio format optimized for STT (16kHz, mono, WebM Opus)
 * - Chunk streaming (1000ms intervals)
 * - Audio level monitoring
 * - Error handling and recovery
 */
export function useAudioCapture(options: AudioCaptureOptions = {}): UseAudioCaptureReturn {
  const [state, setState] = useState<AudioCaptureState>({
    isRecording: false,
    isPaused: false,
    permissionState: 'prompt',
    error: null,
    audioLevel: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pcmProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmGainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunkQueueRef = useRef<
    Array<{ data: string; format: { sampleRate: number; channels: number; encoding: string } }>
  >([]);
  const recordingRef = useRef(false);
  const pausedRef = useRef(false);
  const pcmChunkCountRef = useRef(0); // Track PCM chunks sent for debugging
  const sessionActiveRef = useRef(options.sessionActive === true); // Use ref for current value
  const wsClient = getWebSocketClient();
  const usePcm = options.usePcm === true;
  const sessionActive = options.sessionActive === true;
  const smartListenEnabled = options.smartListenEnabled === true;
  const smartListenBufferMs = options.smartListenBufferMs ?? 10000;
  const ringBufferMaxChunks = Math.max(1, Math.ceil(smartListenBufferMs / 128));
  const ringBufferRef = useRef<string[]>([]);
  const sttWindowOpenRef = useRef(false);
  const sttWindowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const STT_WINDOW_MS = 30000;
  
  // Update ref when sessionActive changes
  useEffect(() => {
    sessionActiveRef.current = sessionActive === true;
    console.log(`[AudioCapture] sessionActive changed to: ${sessionActive}`);
  }, [sessionActive]);

  // Runtime validation: Log warning if PCM mode is enabled but environment suggests wrong provider
  useEffect(() => {
    if (usePcm && typeof window !== 'undefined') {
      const sttProvider = (process.env.NEXT_PUBLIC_STT_PROVIDER || 'mock').toLowerCase();
      if (sttProvider !== 'elevenlabs') {
        console.warn('[useAudioCapture] ⚠️  PCM mode enabled but NEXT_PUBLIC_STT_PROVIDER is not "elevenlabs"');
        console.warn('[useAudioCapture] ⚠️  Backend expects PCM format for ElevenLabs. Set NEXT_PUBLIC_STT_PROVIDER=elevenlabs');
      } else {
        console.log('[useAudioCapture] ✅ PCM mode enabled for ElevenLabs STT');
      }
    }
  }, [usePcm]);

  // Check if MediaRecorder is supported
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setState((prev) => ({
        ...prev,
        permissionState: 'unsupported',
        error: 'MediaRecorder API not supported in this browser',
      }));
      return;
    }

    // Check current permission state
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((result) => {
        if (result.state === 'granted') {
          setState((prev) => ({ ...prev, permissionState: 'granted' }));
        } else if (result.state === 'denied') {
          setState((prev) => ({ ...prev, permissionState: 'denied' }));
        }
      })
      .catch(() => {
        // Permission API not supported, will check on getUserMedia call
      });
  }, []);

  useEffect(() => {
    recordingRef.current = state.isRecording;
    pausedRef.current = state.isPaused;
  }, [state.isRecording, state.isPaused]);

  /**
   * Request microphone permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000, // Optimal for STT
          channelCount: 1, // Mono
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Permission granted
      setState((prev) => ({ ...prev, permissionState: 'granted' }));
      
      // Clean up test stream
      stream.getTracks().forEach((track) => track.stop());
      
      return true;
    } catch (error) {
      const err = error as Error;
      console.error('Microphone permission denied:', err);

      let errorMessage = 'Microphone access denied';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone permission denied. Please allow access in your browser settings.';
        setState((prev) => ({ ...prev, permissionState: 'denied' }));
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Microphone is already in use by another application.';
      } else {
        errorMessage = `Failed to access microphone: ${err.message}`;
      }

      setState((prev) => ({
        ...prev,
        permissionState: 'denied',
        error: errorMessage,
      }));

      return false;
    }
  }, []);

  const ensureAudioContext = useCallback((sampleRate: number) => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      return audioContextRef.current;
    }
    const audioContext = new AudioContext({ sampleRate });
    audioContextRef.current = audioContext;
    return audioContext;
  }, []);

  /**
   * Start audio level monitoring
   */
  const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
    const audioContext = ensureAudioContext(16000);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyserRef.current = analyser;

    audioContext.resume().catch((error) => {
      console.warn('AudioContext resume failed:', error);
    });

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      if (!analyserRef.current) {
        return;
      }

      if (!recordingRef.current) {
        return;
      }

      if (pausedRef.current) {
        setState((prev) => ({ ...prev, audioLevel: 0 }));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average level (0-255)
      const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      
      // Convert to 0-100 scale
      const level = Math.min(100, Math.round((average / 255) * 100));

      setState((prev) => ({ ...prev, audioLevel: level }));

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }, [ensureAudioContext]);

  /**
   * Stop audio level monitoring
   */
  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (pcmProcessorRef.current) {
      pcmProcessorRef.current.disconnect();
      pcmProcessorRef.current = null;
    }

    if (pcmGainRef.current) {
      pcmGainRef.current.disconnect();
      pcmGainRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setState((prev) => ({ ...prev, audioLevel: 0 }));
  }, []);

  const encodePcmToBase64 = useCallback((pcm: Int16Array) => {
    const bytes = new Uint8Array(pcm.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }, []);

  /** Concatenate ring-buffer base64 chunks into one base64 string (decode → concat → encode). */
  const concatBase64Chunks = useCallback((chunks: string[]): string => {
    if (chunks.length === 0) return '';
    const totalLength = chunks.reduce((sum, b64) => sum + (atob(b64).length), 0);
    const out = new Uint8Array(totalLength);
    let offset = 0;
    for (const b64 of chunks) {
      const bin = atob(b64);
      for (let i = 0; i < bin.length; i++) {
        out[offset++] = bin.charCodeAt(i);
      }
    }
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < out.length; i += chunkSize) {
      const chunk = out.subarray(i, Math.min(i + chunkSize, out.length));
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }, []);

  const sendPcmChunk = useCallback(
    (pcmData: Int16Array, captureTime: number) => {
      const base64Audio = encodePcmToBase64(pcmData);
      const format = {
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_s16le',
      };

      // Smart Listen: buffer instead of sending until STT window is open
      if (smartListenEnabled) {
        if (!sttWindowOpenRef.current) {
          ringBufferRef.current.push(base64Audio);
          if (ringBufferRef.current.length > ringBufferMaxChunks) {
            ringBufferRef.current.shift();
          }
          return;
        }
      }

      const isSessionActive = sessionActiveRef.current;
      if (!isSessionActive || !wsClient.isConnected()) {
        if (!isSessionActive) {
          if (pcmChunkCountRef.current < 3) {
            console.warn(`[AudioCapture] ⚠️  Dropping audio chunk: sessionActive=false (session not active yet)`);
          }
          return;
        }
        chunkQueueRef.current.push({ data: base64Audio, format });
        console.warn('[AudioCapture] ⚠️  WebSocket not connected, queuing audio chunk');
        return;
      }

      const message: AudioDataMessage = {
        type: 'AUDIO_DATA',
        payload: {
          data: base64Audio,
          format,
        },
      };

      pcmChunkCountRef.current += 1;
      if (pcmChunkCountRef.current <= 3) {
        console.log(`[AudioCapture] ✅ Sending PCM chunk #${pcmChunkCountRef.current}: ${pcmData.length} samples (${pcmData.length * 2} bytes)`);
      }

      wsClient.send(message, captureTime);
    },
    [encodePcmToBase64, wsClient, smartListenEnabled, ringBufferMaxChunks]
  );

  const startPcmProcessing = useCallback((stream: MediaStream) => {
    const audioContext = ensureAudioContext(16000);
    const source = audioContext.createMediaStreamSource(stream);
    // Buffer size: 2048 samples for balanced latency and message rate
    // 2048 samples / 16000 Hz = 0.128 seconds = 128ms latency (~8 chunks/sec)
    // This prevents RATE_LIMITED errors while still being much faster than original 4096
    // Note: Browser requires buffer size to be a power of two between 256 and 16384
    const processor = audioContext.createScriptProcessor(2048, 1, 1);
    const gain = audioContext.createGain();
    gain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (!recordingRef.current || pausedRef.current) {
        return;
      }
      
      // Debug: Log first few audio processing events
      const processCount = (processor.onaudioprocess as any).__processCount || 0;
      (processor.onaudioprocess as any).__processCount = processCount + 1;
      if (processCount < 3) {
        console.log(`[AudioCapture] 🎤 Processing audio chunk #${processCount + 1}, sessionActive=${sessionActiveRef.current}, isConnected=${wsClient.isConnected()}`);
      }
      
      const input = event.inputBuffer.getChannelData(0);
      // Pre-allocate Int16Array for optimal performance
      const pcm = new Int16Array(input.length);
      // Optimized PCM conversion: Float32 (-1.0 to 1.0) -> Int16 (-32768 to 32767)
      for (let i = 0; i < input.length; i++) {
        const clamped = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      }
      // Send immediately without batching delays
      sendPcmChunk(pcm, Date.now());
    };

    source.connect(processor);
    processor.connect(gain);
    gain.connect(audioContext.destination);

    pcmProcessorRef.current = processor;
    pcmGainRef.current = gain;

    audioContext.resume().catch((error) => {
      console.warn('AudioContext resume failed:', error);
    });
  }, [ensureAudioContext, sendPcmChunk, wsClient]);

  /**
   * Send audio chunk to WebSocket
   */
  const sendAudioChunk = useCallback(
    (chunk: Blob, captureTime: number) => {
      // Only send if session is active
      if (!sessionActive) {
        return; // Silently drop chunks when session is not active
      }

      // Convert blob to Base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        // Remove data URL prefix (data:audio/webm;base64,)
        const base64Audio = base64Data.split(',')[1] || base64Data;

        const format = {
          sampleRate: 16000,
          channels: 1,
          encoding: 'webm-opus',
        };
        const message: AudioDataMessage = {
          type: 'AUDIO_DATA',
          payload: {
            data: base64Audio,
            format,
          },
        };

        // Send via WebSocket if connected, otherwise queue (only if session is active)
        if (wsClient.isConnected()) {
          wsClient.send(message, captureTime);
        } else {
          // Queue chunk for later (will be sent when reconnected)
          chunkQueueRef.current.push({ data: base64Audio, format });
          console.warn('WebSocket not connected, queuing audio chunk');
        }
      };
      reader.readAsDataURL(chunk);
    },
    [wsClient, sessionActive]
  );

  /**
   * Process queued chunks when WebSocket reconnects AND session is active
   */
  const isConnected = wsClient.isConnected();

  useEffect(() => {
    // Only flush queue if session is active and WebSocket is connected
    if (sessionActive && isConnected && chunkQueueRef.current.length > 0) {
      console.log(`Sending ${chunkQueueRef.current.length} queued audio chunks`);
      const queuedChunks = [...chunkQueueRef.current];
      chunkQueueRef.current = [];

      queuedChunks.forEach((chunk) => {
        const message: AudioDataMessage = {
          type: 'AUDIO_DATA',
          payload: {
            data: chunk.data,
            format: chunk.format,
          },
        };
        wsClient.send(message);
      });
    }
  }, [sessionActive, isConnected, wsClient]);

  /**
   * Start recording
   */
  const start = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      // Request permission if not granted
      if (state.permissionState !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          return;
        }
      }

      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      recordingRef.current = true;
      pausedRef.current = false;

      // Start audio level monitoring
      startAudioLevelMonitoring(stream);

      if (usePcm) {
        startPcmProcessing(stream);
      } else {
        // Create MediaRecorder with optimal settings for STT
        const options: MediaRecorderOptions = {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 16000, // Low bitrate for speech
        };

        // Fallback to default if codec not supported
        let recorder: MediaRecorder;
        if (MediaRecorder.isTypeSupported(options.mimeType!)) {
          recorder = new MediaRecorder(stream, options);
        } else {
          // Fallback to default
          recorder = new MediaRecorder(stream);
          console.warn('WebM Opus not supported, using default codec');
        }

        // Handle data available events (chunks)
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && !pausedRef.current) {
            const captureTime = Date.now();
            sendAudioChunk(event.data, captureTime);
          }
        };

        recorder.onerror = (event) => {
          console.error('MediaRecorder error:', event);
          setState((prev) => ({
            ...prev,
            error: 'Recording error occurred',
          }));
        };

        recorder.onstop = () => {
          // Cleanup
          stopAudioLevelMonitoring();
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
          }
        };

        // Start recording with 1000ms chunks
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      }

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        error: null,
      }));
    } catch (error) {
      const err = error as Error;
      console.error('Failed to start recording:', err);
      setState((prev) => ({
        ...prev,
        error: `Failed to start recording: ${err.message}`,
        isRecording: false,
      }));
    }
  }, [state.permissionState, requestPermission, startAudioLevelMonitoring, stopAudioLevelMonitoring, sendAudioChunk, usePcm, startPcmProcessing]);

  /**
   * Smart Bible Listen: open STT window, send ring-buffer catch-up, then send live audio for STT_WINDOW_MS.
   * No-op when not usePcm or not smartListenEnabled or session/ws not ready.
   */
  const requestSttWindow = useCallback(() => {
    if (!usePcm || !smartListenEnabled || !sessionActiveRef.current || !wsClient.isConnected()) {
      return;
    }
    if (sttWindowTimeoutRef.current) {
      clearTimeout(sttWindowTimeoutRef.current);
      sttWindowTimeoutRef.current = null;
    }
    const catchUp = concatBase64Chunks(ringBufferRef.current);
    const msg: SttWindowRequestMessage = {
      type: 'STT_WINDOW_REQUEST',
      payload: catchUp ? { catchUpAudio: catchUp } : {},
    };
    wsClient.send(msg);
    sttWindowOpenRef.current = true;
    sttWindowTimeoutRef.current = setTimeout(() => {
      sttWindowOpenRef.current = false;
      sttWindowTimeoutRef.current = null;
    }, STT_WINDOW_MS);
  }, [usePcm, smartListenEnabled, wsClient, concatBase64Chunks]);

  /**
   * Stop recording
   */
  const stop = useCallback(() => {
    if (sttWindowTimeoutRef.current) {
      clearTimeout(sttWindowTimeoutRef.current);
      sttWindowTimeoutRef.current = null;
    }
    sttWindowOpenRef.current = false;
    ringBufferRef.current = [];

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    recordingRef.current = false;
    pausedRef.current = false;

    stopAudioLevelMonitoring();

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    mediaRecorderRef.current = null;

    setState((prev) => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      audioLevel: 0,
    }));
  }, [stopAudioLevelMonitoring]);

  /**
   * Pause recording
   */
  const pause = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    pausedRef.current = true;
    setState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  /**
   * Resume recording
   */
  const resume = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
    pausedRef.current = false;
    setState((prev) => ({ ...prev, isPaused: false }));

    // Restart audio level monitoring
    if (mediaStreamRef.current) {
      startAudioLevelMonitoring(mediaStreamRef.current);
    }
  }, [startAudioLevelMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    state,
    start,
    stop,
    pause,
    resume,
    requestPermission,
    ...(smartListenEnabled && usePcm ? { requestSttWindow } : {}),
  };
}

