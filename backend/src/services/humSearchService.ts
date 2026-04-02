/**
 * Hum-to-Search Service (v2 — CREPE + DTW)
 *
 * Architecture:
 *   User hum (WAV) → CREPE pitch extraction service → interval sequence
 *   → DTW match against all song_fingerprints → ranked results
 *
 * CREPE extracts a pitch contour (F0 at 10ms intervals) with high accuracy.
 * Interval sequences (semitone deltas) are key-invariant.
 * DTW handles tempo differences naturally.
 *
 * For a catalog of ~2000 songs, brute-force DTW runs in milliseconds.
 *
 * Fallback: if EMBEDDING_SERVICE_URL is not set and BasicPitch is available,
 * falls back to the legacy 128D vector path (match_songs RPC).
 */

import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';
import { matchAgainstCatalog, distanceToSimilarity, subsequenceDtwDistance } from './dtwService';

function getEmbeddingServiceUrl(): string {
  return process.env.EMBEDDING_SERVICE_URL?.trim() || '';
}

export interface SearchResult {
  songId: string;
  title: string;
  artist: string | null;
  similarity: number;
  lyrics: string;
}

interface PitchExtractionResponse {
  pitch_contour: number[];
  interval_sequence: number[];
  confidence: number[];
  num_frames: number;
  num_voiced: number;
  num_intervals: number;
  duration_seconds: number;
}

// Cache of fingerprints for DTW matching (loaded once, refreshed periodically)
interface CachedFingerprint {
  id: string;
  song_id: string | null;
  title: string;
  artist: string | null;
  interval_sequence: number[];
}

let fingerprintCache: CachedFingerprint[] = [];
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // Refresh cache every 5 minutes

/**
 * Load fingerprints with interval_sequence from Supabase into memory cache.
 */
async function loadFingerprintCache(): Promise<CachedFingerprint[]> {
  const now = Date.now();
  if (fingerprintCache.length > 0 && now - cacheLoadedAt < CACHE_TTL_MS) {
    return fingerprintCache;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('[HumSearch] Supabase not configured, cannot load fingerprints');
    return [];
  }

  console.log('[HumSearch] Loading fingerprint cache from Supabase...');
  const { data, error } = await supabase
    .from('song_fingerprints')
    .select('id, song_id, title, artist, interval_sequence')
    .not('interval_sequence', 'is', null);

  if (error) {
    console.error('[HumSearch] Error loading fingerprints:', error);
    return fingerprintCache; // Return stale cache if available
  }

  fingerprintCache = (data || []).map((row: {
    id: string;
    song_id: string | null;
    title: string;
    artist: string | null;
    interval_sequence: number[];
  }) => ({
    id: row.id,
    song_id: row.song_id,
    title: row.title,
    artist: row.artist,
    interval_sequence: row.interval_sequence,
  }));
  cacheLoadedAt = now;

  console.log(`[HumSearch] Cached ${fingerprintCache.length} fingerprints with interval sequences`);
  return fingerprintCache;
}

/**
 * Extract pitch contour and intervals from audio via the CREPE service.
 */
export async function getPitchFromService(audioBuffer: Buffer): Promise<PitchExtractionResponse> {
  const base = getEmbeddingServiceUrl();
  if (!base) {
    throw new Error('EMBEDDING_SERVICE_URL is not set — needed for CREPE pitch extraction');
  }

  const url = `${base.replace(/\/$/, '')}/extract-pitch`;
  const form = new FormData();
  form.append('audio', new Blob([audioBuffer], { type: 'audio/wav' }), 'hum.wav');

  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pitch extraction service error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as PitchExtractionResponse;
  if (!Array.isArray(json.interval_sequence)) {
    throw new Error('Pitch service did not return interval_sequence array');
  }

  return json;
}

/**
 * Legacy: get embedding from the old Wav2Vec2 service.
 * Kept for backward compatibility during migration.
 */
export async function getEmbeddingFromService(audioBuffer: Buffer): Promise<number[]> {
  const base = getEmbeddingServiceUrl();
  if (!base) {
    throw new Error('EMBEDDING_SERVICE_URL is not set');
  }
  const url = `${base.replace(/\/$/, '')}/embed`;
  const form = new FormData();
  form.append('audio', new Blob([audioBuffer], { type: 'audio/wav' }), 'hum.wav');

  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Embedding service error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { embedding?: number[]; pitch_contour?: number[]; interval_sequence?: number[] };

  // New service returns pitch data, not embeddings
  if (json.interval_sequence) {
    return json.interval_sequence;
  }
  if (Array.isArray(json.embedding)) {
    return json.embedding;
  }
  throw new Error('Service did not return expected data');
}

/**
 * Search for songs matching a hummed melody using CREPE + DTW.
 */
export async function searchByHum(
  audioBuffer: Buffer,
  limit: number = 5,
  threshold: number = 0.3
): Promise<SearchResult[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured — cannot perform hum search');
  }

  const embeddingServiceUrl = getEmbeddingServiceUrl();

  // ── CREPE + DTW path (primary) ──────────────────────────────────
  if (embeddingServiceUrl) {
    console.log('[HumSearch] Using CREPE + DTW matching');
    const startTime = Date.now();

    // Step 1: Extract pitch from the hum
    console.log('[HumSearch] Extracting pitch contour via CREPE...');
    const pitchData = await getPitchFromService(audioBuffer);
    const extractionTime = Date.now() - startTime;
    console.log(
      `[HumSearch] Pitch extraction: ${extractionTime}ms — ${pitchData.num_voiced} voiced frames, ${pitchData.num_intervals} intervals, ${pitchData.duration_seconds}s audio`
    );

    if (pitchData.num_intervals < 5) {
      console.log('[HumSearch] Too few intervals extracted (need at least 5). Did you hum a melody?');
      return [];
    }

    // Step 2: Load fingerprint catalog
    const catalog = await loadFingerprintCache();
    if (catalog.length === 0) {
      console.log('[HumSearch] No fingerprints in database. Ingest songs first.');
      return [];
    }

    // Step 3: DTW match against catalog
    console.log(`[HumSearch] DTW matching against ${catalog.length} fingerprints...`);
    const matchStart = Date.now();

    const matches = matchAgainstCatalog(
      pitchData.interval_sequence,
      catalog.map((fp) => ({ intervals: fp.interval_sequence })),
      { threshold, limit, useSubsequence: true }
    );

    const matchTime = Date.now() - matchStart;
    console.log(`[HumSearch] DTW matching took ${matchTime}ms — found ${matches.length} matches`);

    if (matches.length === 0) {
      // Log closest match for debugging
      let bestSimilarity = 0;
      let bestTitle = '?';
      for (let i = 0; i < catalog.length; i++) {
        const fp = catalog[i];
        if (!fp.interval_sequence || fp.interval_sequence.length < 3) continue;
        const dist = subsequenceDtwDistance(pitchData.interval_sequence, fp.interval_sequence);
        const sim = distanceToSimilarity(dist);
        if (sim > bestSimilarity) {
          bestSimilarity = sim;
          bestTitle = fp.title;
        }
      }
      console.log(
        `[HumSearch] Closest match below threshold: "${bestTitle}" (${Math.round(bestSimilarity * 100)}% similarity, threshold: ${Math.round(threshold * 100)}%)`
      );
      return [];
    }

    // Step 4: Fetch lyrics for matched songs
    const supabase = getSupabaseClient()!;
    const results: SearchResult[] = [];

    for (const match of matches) {
      const fp = catalog[match.index];
      let lyrics = '';

      // Try to get lyrics from linked song
      if (fp.song_id) {
        const { data: songData } = await supabase
          .from('songs')
          .select('lyrics')
          .eq('id', fp.song_id)
          .single();
        if (songData?.lyrics) {
          lyrics = songData.lyrics;
        }
      }

      results.push({
        songId: fp.song_id || fp.id,
        title: fp.title,
        artist: fp.artist,
        similarity: match.similarity,
        lyrics,
      });

      console.log(
        `[HumSearch]   → "${fp.title}" by ${fp.artist || 'Unknown'} — ${Math.round(match.similarity * 100)}% similarity`
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(`[HumSearch] Total search time: ${totalTime}ms`);

    return results;
  }

  // ── Legacy BasicPitch fallback ──────────────────────────────────
  console.log('[HumSearch] EMBEDDING_SERVICE_URL not set — falling back to BasicPitch (legacy)');
  const { getMelodyVector } = await import('./melodyService');

  const supabase = getSupabaseClient()!;
  const startTime = Date.now();

  const queryVector = await getMelodyVector(audioBuffer);
  console.log(`[HumSearch] BasicPitch extraction took ${Date.now() - startTime}ms`);

  const { data, error } = await supabase.rpc('match_songs', {
    query_vector: queryVector,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  if (!data || data.length === 0) return [];

  return data.map((row: {
    song_id: string;
    title: string;
    artist: string | null;
    similarity: number;
    lyrics?: string;
  }) => ({
    songId: row.song_id,
    title: row.title,
    artist: row.artist,
    similarity: row.similarity,
    lyrics: row.lyrics ?? '',
  }));
}

/**
 * Force refresh the fingerprint cache (e.g., after ingesting new songs).
 */
export function invalidateFingerprintCache(): void {
  fingerprintCache = [];
  cacheLoadedAt = 0;
  console.log('[HumSearch] Fingerprint cache invalidated');
}

/**
 * Get the melody vector for an audio buffer without searching (legacy).
 */
export async function extractMelodyVector(audioBuffer: Buffer): Promise<number[]> {
  const { getMelodyVector } = await import('./melodyService');
  return getMelodyVector(audioBuffer);
}
