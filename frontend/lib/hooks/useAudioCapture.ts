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
export function useAudioCapture(): UseAudioCaptureReturn {
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
  const animationFrameRef = useRef<number | null>(null);
  const chunkQueueRef = useRef<string[]>([]);
  const recordingRef = useRef(false);
  const pausedRef = useRef(false);
  const wsClient = getWebSocketClient();

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

  /**
   * Start audio level monitoring
   */
  const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    const audioContext = new AudioContext({ sampleRate: 16000 });
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
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
  }, []);

  /**
   * Stop audio level monitoring
   */
  const stopAudioLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setState((prev) => ({ ...prev, audioLevel: 0 }));
  }, []);

  /**
   * Send audio chunk to WebSocket
   */
  const sendAudioChunk = useCallback(
    (chunk: Blob, captureTime: number) => {
      // Convert blob to Base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        // Remove data URL prefix (data:audio/webm;base64,)
        const base64Audio = base64Data.split(',')[1] || base64Data;

        const message: AudioDataMessage = {
          type: 'AUDIO_DATA',
          payload: {
            data: base64Audio,
            format: {
              sampleRate: 16000,
              channels: 1,
              encoding: 'webm-opus',
            },
          },
        };

        // Send via WebSocket if connected, otherwise queue
        if (wsClient.isConnected()) {
          wsClient.send(message, captureTime);
        } else {
          // Queue chunk for later (will be sent when reconnected)
          chunkQueueRef.current.push(base64Audio);
          console.warn('WebSocket not connected, queuing audio chunk');
        }
      };
      reader.readAsDataURL(chunk);
    },
    [wsClient]
  );

  /**
   * Process queued chunks when WebSocket reconnects
   */
  const isConnected = wsClient.isConnected();

  useEffect(() => {
    if (isConnected && chunkQueueRef.current.length > 0) {
      console.log(`Sending ${chunkQueueRef.current.length} queued audio chunks`);
      const queuedChunks = [...chunkQueueRef.current];
      chunkQueueRef.current = [];

      queuedChunks.forEach((chunk) => {
        const message: AudioDataMessage = {
          type: 'AUDIO_DATA',
          payload: {
            data: chunk,
            format: {
              sampleRate: 16000,
              channels: 1,
              encoding: 'webm-opus',
            },
          },
        };
        wsClient.send(message);
      });
    }
  }, [isConnected, wsClient]);

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
  }, [state.permissionState, requestPermission, startAudioLevelMonitoring, stopAudioLevelMonitoring, sendAudioChunk]);

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
      pausedRef.current = true;
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, []);

  /**
   * Resume recording
   */
  const resume = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      pausedRef.current = false;
      setState((prev) => ({ ...prev, isPaused: false }));

      // Restart audio level monitoring
      if (mediaStreamRef.current) {
        startAudioLevelMonitoring(mediaStreamRef.current);
      }
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

