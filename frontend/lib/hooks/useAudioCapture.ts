/**
 * Audio Capture Hook
 * 
 * Captures audio from browser microphone and streams to WebSocket
 * Optimized for speech-to-text (16kHz, mono, WebM Opus)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getWebSocketClient } from '../websocket/client';
import type { AudioDataMessage } from '../websocket/types';

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
}

export interface AudioCaptureOptions {
  usePcm?: boolean;
  sessionActive?: boolean; // Only send audio when session is active
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

  const sendPcmChunk = useCallback(
    (pcmData: Int16Array, captureTime: number) => {
      // Use ref to get current sessionActive value (always up-to-date)
      const isSessionActive = sessionActiveRef.current;
      
      // Only send if session is active and WebSocket is connected
      if (!isSessionActive || !wsClient.isConnected()) {
        // Don't queue if session is not active - just drop the chunk
        if (!isSessionActive) {
          // Log first few dropped chunks to help debug
          if (pcmChunkCountRef.current < 3) {
            console.warn(`[AudioCapture] ⚠️  Dropping audio chunk: sessionActive=false (session not active yet)`);
          }
          return; // Silently drop chunks when session is not active
        }
        // Queue only if WebSocket is disconnected but session is active
        const base64Audio = encodePcmToBase64(pcmData);
        const format = {
          sampleRate: 16000,
          channels: 1,
          encoding: 'pcm_s16le',
        };
        chunkQueueRef.current.push({ data: base64Audio, format });
        console.warn('[AudioCapture] ⚠️  WebSocket not connected, queuing audio chunk');
        return;
      }

      const base64Audio = encodePcmToBase64(pcmData);
      const format = {
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_s16le',
      };
      const message: AudioDataMessage = {
        type: 'AUDIO_DATA',
        payload: {
          data: base64Audio,
          format,
        },
      };

      // Log first few chunks to verify audio is being sent
      pcmChunkCountRef.current += 1;
      if (pcmChunkCountRef.current <= 3) {
        console.log(`[AudioCapture] ✅ Sending PCM chunk #${pcmChunkCountRef.current}: ${pcmData.length} samples (${pcmData.length * 2} bytes)`);
      }

      wsClient.send(message, captureTime);
    },
    [encodePcmToBase64, wsClient, sessionActive]
  );

  const startPcmProcessing = useCallback((stream: MediaStream) => {
    const audioContext = ensureAudioContext(16000);
    const source = audioContext.createMediaStreamSource(stream);
    // Reduced buffer size from 4096 to 256 for low latency (16ms instead of 256ms)
    // 256 samples / 16000 Hz = 0.016 seconds = 16ms latency
    // Note: Browser requires buffer size to be a power of two between 256 and 16384
    const processor = audioContext.createScriptProcessor(256, 1, 1);
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
  }, [ensureAudioContext, sendPcmChunk, sessionActive, wsClient]);

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
   * Stop recording
   */
  const stop = useCallback(() => {
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
  };
}

