/**
 * Auto-Fingerprint Service
 *
 * When a song is created/updated, this service:
 * 1. Searches YouTube for the song (title + artist)
 * 2. Downloads the audio via yt-dlp
 * 3. Extracts pitch contour via CREPE service
 * 4. Stores the fingerprint in song_fingerprints for hum-to-search
 *
 * Runs asynchronously — never blocks song creation.
 * If it fails (no YouTube result, CREPE down, etc.), the song still works fine,
 * it just won't be matchable by humming until manually fingerprinted.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';
import { invalidateFingerprintCache } from './humSearchService';

function getEmbeddingServiceUrl(): string {
  return process.env.EMBEDDING_SERVICE_URL?.trim() || '';
}

interface PitchResponse {
  pitch_contour: number[];
  interval_sequence: number[];
  num_frames: number;
  num_voiced: number;
  num_intervals: number;
  duration_seconds: number;
}

/**
 * Search YouTube for a song and return the video ID.
 * Returns null if no result found.
 */
function searchYouTube(title: string, artist: string): string | null {
  const query = `${title} ${artist} lyrics`;
  try {
    const result = execSync(
      `yt-dlp "ytsearch1:${query.replace(/"/g, '\\"')}" --get-id --no-playlist 2>/dev/null`,
      { timeout: 30000, encoding: 'utf-8' }
    ).trim();
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Download audio from YouTube as WAV (16kHz mono).
 * Returns path to temp WAV file, or null on failure.
 */
function downloadAudio(videoId: string, tmpDir: string): string | null {
  const outputTemplate = path.join(tmpDir, 'audio.%(ext)s');
  try {
    execSync(
      `yt-dlp --no-playlist --extract-audio --audio-format wav ` +
      `--postprocessor-args "ffmpeg:-ar 16000 -ac 1" ` +
      `--output "${outputTemplate}" --quiet --no-warnings ` +
      `"https://www.youtube.com/watch?v=${videoId}"`,
      { timeout: 120000 }
    );
  } catch {
    return null;
  }

  // Find the output file
  const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith('audio'));
  if (files.length === 0) return null;

  const filePath = path.join(tmpDir, files[0]);
  if (!filePath.endsWith('.wav')) {
    // Convert if needed
    const wavPath = filePath.replace(/\.[^.]+$/, '.wav');
    try {
      execSync(`ffmpeg -i "${filePath}" -ar 16000 -ac 1 "${wavPath}" -y -loglevel quiet`);
      fs.unlinkSync(filePath);
      return wavPath;
    } catch {
      return null;
    }
  }
  return filePath;
}

/**
 * Extract pitch contour from WAV file via CREPE service.
 * Uses voiced_threshold=0 for polyphonic YouTube audio.
 */
async function extractPitch(wavPath: string): Promise<PitchResponse | null> {
  const serviceUrl = getEmbeddingServiceUrl();
  if (!serviceUrl) return null;

  const audioBuffer = fs.readFileSync(wavPath);
  const url = `${serviceUrl.replace(/\/$/, '')}/extract-pitch?voiced_threshold=0`;

  const form = new FormData();
  form.append('audio', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');

  try {
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) return null;
    return (await res.json()) as PitchResponse;
  } catch {
    return null;
  }
}

/**
 * Auto-fingerprint a song: search YouTube → download → extract pitch → store.
 *
 * @param songId - ID from the songs table (to link fingerprint to user's song)
 * @param title - Song title
 * @param artist - Song artist
 * @returns true if fingerprint was created, false otherwise
 */
export async function autoFingerprint(
  songId: string,
  title: string,
  artist: string
): Promise<boolean> {
  const tag = `[AutoFingerprint] "${title}" by ${artist || 'Unknown'}`;

  if (!isSupabaseConfigured()) {
    console.warn(`${tag} Supabase not configured, skipping`);
    return false;
  }

  const serviceUrl = getEmbeddingServiceUrl();
  if (!serviceUrl) {
    console.warn(`${tag} EMBEDDING_SERVICE_URL not set, skipping`);
    return false;
  }

  // Check if fingerprint already exists for this song
  const supabase = getSupabaseClient()!;
  const { data: existing } = await supabase
    .from('song_fingerprints')
    .select('id, interval_sequence')
    .eq('title', title)
    .eq('artist', artist || '')
    .not('interval_sequence', 'is', null)
    .limit(1)
    .maybeSingle();

  if (existing?.interval_sequence) {
    console.log(`${tag} Fingerprint already exists, linking to song_id`);
    // Link existing fingerprint to this song_id if not already linked
    if (songId) {
      await supabase
        .from('song_fingerprints')
        .update({ song_id: songId })
        .eq('id', existing.id);
    }
    return true;
  }

  console.log(`${tag} Starting auto-fingerprint...`);

  // Step 1: Search YouTube
  console.log(`${tag} Searching YouTube...`);
  const videoId = searchYouTube(title, artist);
  if (!videoId) {
    console.warn(`${tag} No YouTube result found`);
    return false;
  }
  console.log(`${tag} Found video: ${videoId}`);

  // Step 2: Download audio
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parleap-autofp-'));
  try {
    console.log(`${tag} Downloading audio...`);
    const wavPath = downloadAudio(videoId, tmpDir);
    if (!wavPath) {
      console.warn(`${tag} Download failed`);
      return false;
    }

    // Step 3: Extract pitch via CREPE
    console.log(`${tag} Extracting pitch contour...`);
    const pitchData = await extractPitch(wavPath);
    if (!pitchData || pitchData.num_intervals < 10) {
      console.warn(`${tag} Pitch extraction failed or too few intervals`);
      return false;
    }

    console.log(
      `${tag} Got ${pitchData.num_intervals} intervals from ${pitchData.duration_seconds}s`
    );

    // Step 4: Store fingerprint
    const row = {
      song_id: songId || null,
      title,
      artist: artist || null,
      pitch_contour: pitchData.pitch_contour,
      interval_sequence: pitchData.interval_sequence,
      source: 'auto',
    };

    // Upsert: update if exists by title+artist, insert otherwise
    if (existing) {
      const { error } = await supabase
        .from('song_fingerprints')
        .update(row)
        .eq('id', existing.id);
      if (error) {
        console.error(`${tag} DB update error:`, error);
        return false;
      }
    } else {
      const { error } = await supabase
        .from('song_fingerprints')
        .insert(row);
      if (error) {
        console.error(`${tag} DB insert error:`, error);
        return false;
      }
    }

    // Invalidate cache so the new fingerprint is available immediately
    invalidateFingerprintCache();

    console.log(`${tag} Fingerprint stored successfully`);
    return true;
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

/**
 * Check if auto-fingerprinting is available (CREPE service + yt-dlp installed).
 */
export function isAutoFingerprintAvailable(): boolean {
  if (!getEmbeddingServiceUrl()) return false;
  if (!isSupabaseConfigured()) return false;

  // Check yt-dlp is installed
  try {
    execSync('which yt-dlp', { timeout: 5000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
