/**
 * Hum-to-Search Service
 * 
 * Handles searching for songs by melody vector similarity.
 * Uses pgvector's cosine similarity search via the match_songs() function.
 */

import { supabase, isSupabaseConfigured } from '../config/supabase';
import { getMelodyVector } from './melodyService';

export interface SearchResult {
  songId: string;
  title: string;
  artist: string | null;
  similarity: number;
  lyrics: string;
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
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured - cannot perform hum search');
  }

  console.log('[HumSearch] Extracting melody vector from audio...');
  const startTime = Date.now();
  
  // Extract melody vector from the audio
  const queryVector = await getMelodyVector(audioBuffer);
  const extractionTime = Date.now() - startTime;
  console.log(`[HumSearch] Vector extraction took ${extractionTime}ms`);

  // Call the match_songs function in Supabase
  // pgvector RPC params: pass vector as string literal "[a,b,c,...]" so PostgREST sends it correctly
  const queryVectorStr = `[${queryVector.join(',')}]`;
  console.log('[HumSearch] Searching database for matches...', '(vector length:', queryVector.length, ')');
  const searchStart = Date.now();

  const { data, error } = await supabase.rpc('match_songs', {
    query_vector: queryVectorStr,
    match_threshold: threshold,
    match_count: limit,
  });

  const searchTime = Date.now() - searchStart;
  console.log(`[HumSearch] Database search took ${searchTime}ms`);

  if (error) {
    console.error('[HumSearch] Database error:', error);
    throw new Error(`Search failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('[HumSearch] No matches found');
    console.log('[HumSearch] Fetching closest match for diagnostics...');
    const { data: closest, error: closestError } = await supabase.rpc('match_songs', {
      query_vector: queryVectorStr,
      match_threshold: 0,
      match_count: 1,
    });
    if (closestError) {
      console.warn('[HumSearch] Could not get closest match (for logging):', closestError.message);
    } else if (closest && closest.length > 0) {
      const row = closest[0] as { similarity?: number; title?: string };
      const sim = row?.similarity;
      const title = row?.title;
      console.log(`[HumSearch] Closest match below threshold: "${title ?? '?'}" (${sim != null ? Math.round(sim * 100) : '?'}% similarity)`);
    } else {
      console.log('[HumSearch] No fingerprints in database (closest query returned empty)');
    }
    return [];
  }

  console.log(`[HumSearch] Found ${data.length} matches`);
  
  // Map results to SearchResult interface (lyrics optional for backward compatibility with pre-016 migration)
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
