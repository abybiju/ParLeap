/**
 * Lightweight wake-word detection for Smart Bible Listen.
 * Uses browser Web Speech API (no backend cost) to detect Bible-related phrases
 * and invokes onWake so the client can open the STT window (ring buffer + live stream).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { shouldWakeForBibleTranscript } from '../data/bibleWakeWords';

export interface UseBibleWakeWordOptions {
  /** When true, start listening for wake words. */
  enabled: boolean;
  /** Called when a wake word/phrase is detected. Typically requestSttWindow from useAudioCapture. */
  onWake: () => void;
  /** Cooldown in ms after a trigger to avoid repeated fires (default 3000). */
  cooldownMs?: number;
}

export interface UseBibleWakeWordReturn {
  isListening: boolean;
  error: string | null;
  /** Manual trigger (e.g. operator button). */
  trigger: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export function useBibleWakeWord(options: UseBibleWakeWordOptions): UseBibleWakeWordReturn {
  const { enabled, onWake, cooldownMs = 3000 } = options;
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const cooldownUntilRef = useRef(0);
  const transcriptTailRef = useRef('');

  const trigger = useCallback(() => {
    if (Date.now() < cooldownUntilRef.current) return;
    cooldownUntilRef.current = Date.now() + cooldownMs;
    onWake();
  }, [onWake, cooldownMs]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      setIsListening(false);
      setError(null);
      transcriptTailRef.current = '';
      return;
    }

    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    setError(null);
    const recognition = new SpeechRecognitionCtor() as SpeechRecognitionInstance;
    recognition.continuous = true;
    // Use final chunks only to reduce false wakeups from partial/noisy interim tokens.
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (Date.now() < cooldownUntilRef.current) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.isFinal) continue;
        const transcript = result[0]?.transcript?.trim();
        if (!transcript) continue;

        const merged = `${transcriptTailRef.current} ${transcript}`.trim();
        transcriptTailRef.current = merged
          .split(/\s+/)
          .filter(Boolean)
          .slice(-24)
          .join(' ');

        if (!shouldWakeForBibleTranscript(merged)) {
          continue;
        }

        cooldownUntilRef.current = Date.now() + cooldownMs;
        onWake();
        break;
      }
    };

    recognition.onerror = (event: { error?: string }) => {
      const err = event.error;
      if (err === 'aborted' || err === 'no-speech') return;
      setError(err ?? 'Speech recognition error');
    };

    recognition.onend = () => {
      setIsListening(false);
      if (enabled && recognitionRef.current === recognition) {
        try {
          recognition.start();
          setIsListening(true);
        } catch {
          // may fail if already ended
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to start recognition');
      recognitionRef.current = null;
    }

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      setIsListening(false);
      transcriptTailRef.current = '';
    };
  }, [enabled, onWake, cooldownMs]);

  return {
    isListening,
    error,
    trigger,
  };
}
