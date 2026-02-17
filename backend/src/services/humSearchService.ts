/**
 * Hum-to-Search Service
 *
 * Handles searching for songs by melody/embedding similarity.
 * - If EMBEDDING_SERVICE_URL is set: YouTube-style path — POST WAV to embedding service, then match_songs_by_embedding (768-dim).
 * - Otherwise: BasicPitch melody vector (128-dim) + match_songs().
 */

import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';
import { getMelodyVector } from './melodyService';

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

interface EmbeddingResponse {
  embedding: number[];
  dim: number;
}

/**
 * Get 768-dim embedding from the Python embedding service (YouTube-style).
 * Exported for use by the ingest script.
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

  const json = (await res.json()) as EmbeddingResponse;
  if (!Array.isArray(json.embedding)) {
    throw new Error('Embedding service did not return embedding array');
  }
  return json.embedding;
}

/**
 * Search for songs matching a hummed melody
 *
 * @param audioBuffer - WAV audio buffer of the user's hum
 * @param limit - Maximum number of results (default: 5)
 * @param threshold - Minimum similarity threshold (default: 0.5)
 * @returns Array of matching songs sorted by similarity
 */
export async function searchByHum(
  audioBuffer: Buffer,
  limit: number = 5,
  threshold: number = 0.5
): Promise<SearchResult[]> {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase not configured - cannot perform hum search');
  }

  const embeddingServiceUrl = getEmbeddingServiceUrl();
  const useEmbeddingService = embeddingServiceUrl.length > 0;

  if (useEmbeddingService) {
    console.log('[HumSearch] Using YouTube-style embedding service:', embeddingServiceUrl);
  } else {
    console.log('[HumSearch] Using BasicPitch melody vector (match_songs)');
  }

  console.log('[HumSearch] Extracting vector from audio...');
  const startTime = Date.now();

  let queryVector: number[];
  let rpcName: string;
  let rpcParams: { query_embedding?: number[]; query_vector?: number[]; match_threshold: number; match_count: number };

  if (useEmbeddingService) {
    queryVector = await getEmbeddingFromService(audioBuffer);
    rpcName = 'match_songs_by_embedding';
    rpcParams = {
      query_embedding: queryVector,
      match_threshold: threshold,
      match_count: limit,
    };
  } else {
    queryVector = await getMelodyVector(audioBuffer);
    rpcName = 'match_songs';
    rpcParams = {
      query_vector: queryVector,
      match_threshold: threshold,
      match_count: limit,
    };
  }

  const extractionTime = Date.now() - startTime;
  console.log(`[HumSearch] Vector extraction took ${extractionTime}ms (dim: ${queryVector.length})`);

  const { count: tableCount } = await supabase
    .from('song_fingerprints')
    .select('id', { count: 'exact', head: true });
  console.log('[HumSearch] song_fingerprints row count (from backend):', tableCount ?? 'null');

  console.log('[HumSearch] Searching database for matches...');
  const searchStart = Date.now();

  const { data, error } = await supabase.rpc(rpcName, rpcParams);

  const searchTime = Date.now() - searchStart;
  console.log(`[HumSearch] Database search took ${searchTime}ms`);

  if (error) {
    console.error('[HumSearch] Database error:', error);
    throw new Error(`Search failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('[HumSearch] No matches found');
    const closestParams = useEmbeddingService
      ? { query_embedding: queryVector, match_threshold: 0, match_count: 1 }
      : { query_vector: queryVector, match_threshold: 0, match_count: 1 };
    const closestRpc = useEmbeddingService ? 'match_songs_by_embedding' : 'match_songs';
    const { data: closest, error: closestError } = await supabase.rpc(closestRpc, closestParams);
    if (closestError) {
      console.warn('[HumSearch] Could not get closest match (for logging):', closestError.message);
    } else if (closest && closest.length > 0) {
      const row = closest[0] as { similarity?: number; title?: string };
      console.log(
        `[HumSearch] Closest match below threshold: "${row?.title ?? '?'}" (${row?.similarity != null ? Math.round(row.similarity * 100) : '?'}% similarity)`
      );
    } else {
      console.log('[HumSearch] No matching fingerprints (closest query returned empty)');
    }
    return [];
  }

  console.log(`[HumSearch] Found ${data.length} matches`);

  const results: SearchResult[] = data.map((row: {
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

  return results;
}

/**
 * Get the melody vector for an audio buffer without searching
 * Useful for debugging or pre-computing vectors
 */
export async function extractMelodyVector(audioBuffer: Buffer): Promise<number[]> {
  return getMelodyVector(audioBuffer);
}
