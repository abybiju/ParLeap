/**
 * Live hum-to-search: stream audio chunks, match on the fly using CREPE + DTW.
 *
 * Requires EMBEDDING_SERVICE_URL pointing to the CREPE pitch extraction service.
 * Accumulates a rolling buffer of audio, extracts pitch at each chunk,
 * and runs DTW against the fingerprint catalog.
 */

import { WaveFile } from 'wavefile';
import { isSupabaseConfigured } from '../config/supabase';
import type { SearchResult } from './humSearchService';

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL?.trim() || '';

/** Keep last 5 seconds of audio (samples). */
const SAMPLE_RATE = 22050;
const MAX_SAMPLES = SAMPLE_RATE * 5;
/** Minimum samples before we run pitch extraction (e.g. 2s). */
const MIN_SAMPLES = SAMPLE_RATE * 2;

/** Require confident match so silence/random hum does not return results. */
const LIVE_MATCH_THRESHOLD = 0.4;
const LIVE_MATCH_COUNT = 5;

/** Session: rolling PCM buffer (int16 range). */
interface LiveSession {
  pcmSamples: number[];
  sampleRate: number;
  lastUpdated: number;
}

const sessions = new Map<string, LiveSession>();

const SESSION_TTL_MS = 2 * 60 * 1000;

function getSamplesFromWav(buffer: Buffer): { samples: number[]; sampleRate: number } {
  const wav = new WaveFile(buffer);
  const samples = wav.getSamples(false, Int16Array);
  const sr = (wav.fmt as { sampleRate: number }).sampleRate;
  const arr: number[] = Array.isArray(samples)
    ? Array.from(samples[0] as unknown as Int16Array)
    : Array.from(samples as unknown as Int16Array);
  return { samples: arr, sampleRate: sr };
}

function pcmToWavBuffer(pcmSamples: number[], sampleRate: number): Buffer {
  const wav = new WaveFile();
  wav.fromScratch(1, sampleRate, '16', pcmSamples);
  return Buffer.from(wav.toBuffer());
}

function cleanupStaleSessions(): void {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastUpdated > SESSION_TTL_MS) sessions.delete(id);
  }
}

export function isLiveHumAvailable(): boolean {
  return EMBEDDING_SERVICE_URL.length > 0 && isSupabaseConfigured();
}

export function createSession(): string {
  cleanupStaleSessions();
  const id = `live_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  sessions.set(id, {
    pcmSamples: [],
    sampleRate: SAMPLE_RATE,
    lastUpdated: Date.now(),
  });
  return id;
}

export interface LiveChunkResult {
  status: 'listening' | 'match';
  results?: SearchResult[];
  similarity?: number;
}

export async function processChunk(sessionId: string, audioBase64: string): Promise<LiveChunkResult> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  session.lastUpdated = Date.now();

  let buffer: Buffer;
  try {
    buffer = Buffer.from(audioBase64, 'base64');
  } catch {
    throw new Error('Invalid base64 audio');
  }
  if (buffer.length < 44) {
    return { status: 'listening' };
  }

  const { samples, sampleRate } = getSamplesFromWav(buffer);
  session.pcmSamples.push(...samples);
  if (session.sampleRate !== sampleRate) {
    session.sampleRate = sampleRate;
  }
  // Keep last 5s
  if (session.pcmSamples.length > MAX_SAMPLES) {
    session.pcmSamples = session.pcmSamples.slice(-MAX_SAMPLES);
  }

  if (session.pcmSamples.length < MIN_SAMPLES) {
    return { status: 'listening' };
  }

  // Convert rolling buffer to WAV and run CREPE + DTW via searchByHum
  const wavBuffer = pcmToWavBuffer(session.pcmSamples, session.sampleRate);

  const { searchByHum } = await import('./humSearchService');
  const results = await searchByHum(
    wavBuffer,
    LIVE_MATCH_COUNT,
    LIVE_MATCH_THRESHOLD
  );

  if (results.length > 0) {
    return {
      status: 'match',
      results,
      similarity: results[0].similarity,
    };
  }

  return { status: 'listening' };
}

export function stopSession(sessionId: string): void {
  sessions.delete(sessionId);
}
