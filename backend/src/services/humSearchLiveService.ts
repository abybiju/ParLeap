/**
 * Live hum-to-search: stream audio chunks, match on the fly (YouTube-style).
 * Requires EMBEDDING_SERVICE_URL and match_songs_by_embedding (768D).
 */

import { WaveFile } from 'wavefile';
import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';
import { getEmbeddingFromService } from './humSearchService';
import type { SearchResult } from './humSearchService';

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL?.trim() || '';

/** Keep last 5 seconds of audio (samples). */
const SAMPLE_RATE = 22050;
const MAX_SAMPLES = SAMPLE_RATE * 5;
/** Minimum samples before we run embedding (e.g. 2s). */
const MIN_SAMPLES = SAMPLE_RATE * 2;

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
  const sr = wav.fmt.sampleRate;
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

  const wavBuffer = pcmToWavBuffer(session.pcmSamples, session.sampleRate);
  let embedding: number[];
  try {
    embedding = await getEmbeddingFromService(wavBuffer);
  } catch (err) {
    console.error('[HumSearchLive] Embedding service error:', err);
    throw err;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.rpc('match_songs_by_embedding', {
    query_embedding: embedding,
    match_threshold: LIVE_MATCH_THRESHOLD,
    match_count: LIVE_MATCH_COUNT,
  });

  if (error) {
    console.error('[HumSearchLive] match_songs_by_embedding error:', error);
    throw new Error(`Search failed: ${error.message}`);
  }

  if (data && data.length > 0) {
    const top = data[0] as { song_id: string; title: string; artist: string | null; similarity: number; lyrics?: string };
    const results: SearchResult[] = data.map((row: { song_id: string; title: string; artist: string | null; similarity: number; lyrics?: string }) => ({
      songId: row.song_id,
      title: row.title,
      artist: row.artist,
      similarity: row.similarity,
      lyrics: row.lyrics ?? '',
    }));
    return {
      status: 'match',
      results,
      similarity: top.similarity,
    };
  }

  return { status: 'listening' };
}

export function stopSession(sessionId: string): void {
  sessions.delete(sessionId);
}
