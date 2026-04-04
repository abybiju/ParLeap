/**
 * YouTube Ingestion Script for Hum-to-Search
 *
 * Downloads audio from YouTube URLs, extracts pitch contours via CREPE,
 * and stores interval sequences in song_fingerprints for DTW matching.
 *
 * Usage:
 *   # Single song:
 *   npm run ingest:youtube -- --url "https://youtube.com/watch?v=..." --title "Amazing Grace" --artist "Traditional"
 *
 *   # Batch from song list:
 *   npm run ingest:youtube -- --file songs.json
 *
 * songs.json format:
 *   [
 *     { "url": "https://youtube.com/watch?v=...", "title": "Amazing Grace", "artist": "Traditional" },
 *     { "url": "https://youtube.com/watch?v=...", "title": "Way Maker", "artist": "Sinach" }
 *   ]
 *
 * Requirements:
 *   - yt-dlp installed (brew install yt-dlp)
 *   - CREPE service running (EMBEDDING_SERVICE_URL in .env)
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const embeddingServiceUrl = (process.env.EMBEDDING_SERVICE_URL || '').trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env');
  process.exit(1);
}

if (!embeddingServiceUrl) {
  console.error('Error: EMBEDDING_SERVICE_URL must be set (CREPE service URL)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SongEntry {
  url: string;
  title: string;
  artist: string;
  song_id?: string; // Optional: link to existing songs table
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
 * Download audio from YouTube as WAV using yt-dlp + ffmpeg.
 * Returns path to the temporary WAV file.
 */
function downloadYouTubeAudio(url: string, outputDir: string): string {
  const outputPath = path.join(outputDir, 'audio.wav');

  console.log('   Downloading audio from YouTube...');

  // yt-dlp: download best audio, convert to WAV 16kHz mono via ffmpeg
  const cmd = [
    'yt-dlp',
    '--no-playlist',           // Single video only
    '--extract-audio',
    '--audio-format', 'wav',
    '--postprocessor-args', '"ffmpeg:-ar 16000 -ac 1"', // 16kHz mono
    '--output', `"${outputPath.replace('.wav', '.%(ext)s')}"`,
    '--quiet',
    '--no-warnings',
    `"${url}"`,
  ].join(' ');

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 120000 }); // 2 min timeout
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`yt-dlp failed: ${msg}`);
  }

  // yt-dlp may output as .wav directly
  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  // Check for other extensions that yt-dlp might have created
  const files = fs.readdirSync(outputDir).filter((f) => f.startsWith('audio'));
  if (files.length > 0) {
    const actualPath = path.join(outputDir, files[0]);
    // If not WAV, convert with ffmpeg
    if (!actualPath.endsWith('.wav')) {
      const wavPath = actualPath.replace(/\.[^.]+$/, '.wav');
      execSync(`ffmpeg -i "${actualPath}" -ar 16000 -ac 1 "${wavPath}" -y -loglevel quiet`);
      fs.unlinkSync(actualPath);
      return wavPath;
    }
    return actualPath;
  }

  throw new Error('yt-dlp did not produce output file');
}

/**
 * Extract pitch contour from WAV file via CREPE service.
 */
async function extractPitch(wavPath: string): Promise<PitchResponse> {
  const audioBuffer = fs.readFileSync(wavPath);
  // separate_vocals=true: Demucs isolates vocal track before pitch extraction.
  // This makes reference fingerprints structurally compatible with browser hums
  // (both represent isolated vocal melody, not full-mix instrument soup).
  const url = `${embeddingServiceUrl.replace(/\/$/, '')}/extract-pitch?voiced_threshold=0.05&separate_vocals=true`;

  const form = new FormData();
  form.append('audio', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');

  const res = await fetch(url, { method: 'POST', body: form });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CREPE service error ${res.status}: ${text}`);
  }

  return (await res.json()) as PitchResponse;
}

/**
 * Process a single song: download → extract pitch → store in Supabase.
 */
async function processSong(entry: SongEntry): Promise<boolean> {
  console.log(`\n  Processing: ${entry.title} — ${entry.artist}`);
  console.log(`   URL: ${entry.url}`);

  const tmpDir = fs.mkdtempSync(path.join('/tmp', 'parleap-ingest-'));

  try {
    // Step 1: Download audio
    const wavPath = downloadYouTubeAudio(entry.url, tmpDir);
    const fileSize = fs.statSync(wavPath).size;
    console.log(`   Downloaded: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

    // Step 2: Extract pitch via CREPE
    console.log('   Extracting pitch contour via CREPE...');
    const startTime = Date.now();
    const pitchData = await extractPitch(wavPath);
    const extractionTime = Date.now() - startTime;

    console.log(
      `   Pitch extraction: ${extractionTime}ms — ${pitchData.num_voiced} voiced frames, ${pitchData.num_intervals} intervals, ${pitchData.duration_seconds}s`
    );

    if (pitchData.num_intervals < 10) {
      console.log('   WARNING: Very few intervals extracted. Song may not match well.');
    }

    // Step 3: Store in Supabase
    const row: Record<string, unknown> = {
      title: entry.title,
      artist: entry.artist,
      pitch_contour: pitchData.pitch_contour,
      interval_sequence: pitchData.interval_sequence,
      source: 'youtube',
    };

    if (entry.song_id) {
      row.song_id = entry.song_id;
    }

    // Check if fingerprint already exists
    const { data: existing } = await supabase
      .from('song_fingerprints')
      .select('id')
      .eq('title', entry.title)
      .eq('artist', entry.artist)
      .single();

    if (existing) {
      console.log('   Fingerprint exists, updating...');
      const { error } = await supabase
        .from('song_fingerprints')
        .update(row)
        .eq('id', existing.id);
      if (error) throw error;
      console.log('   Updated fingerprint');
    } else {
      const { error } = await supabase.from('song_fingerprints').insert(row);
      if (error) throw error;
      console.log('   Inserted new fingerprint');
    }

    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`   ERROR: ${msg}`);
    return false;
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Parse command line arguments.
 */
function parseArgs(): SongEntry[] {
  const args = process.argv.slice(2);
  const songs: SongEntry[] = [];

  let i = 0;
  while (i < args.length) {
    if (args[i] === '--file' && args[i + 1]) {
      // Batch mode: read from JSON file
      const filePath = path.resolve(args[i + 1]);
      if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
      }
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!Array.isArray(content)) {
        console.error('Error: JSON file must contain an array of songs');
        process.exit(1);
      }
      songs.push(...content);
      i += 2;
    } else if (args[i] === '--url' && args[i + 1]) {
      // Single song mode
      const url = args[i + 1];
      let title = 'Unknown';
      let artist = 'Unknown';
      let song_id: string | undefined;

      i += 2;
      while (i < args.length) {
        if (args[i] === '--title' && args[i + 1]) {
          title = args[i + 1];
          i += 2;
        } else if (args[i] === '--artist' && args[i + 1]) {
          artist = args[i + 1];
          i += 2;
        } else if (args[i] === '--song-id' && args[i + 1]) {
          song_id = args[i + 1];
          i += 2;
        } else {
          break;
        }
      }

      songs.push({ url, title, artist, song_id });
    } else {
      console.error(`Unknown argument: ${args[i]}`);
      console.error('Usage:');
      console.error('  npm run ingest:youtube -- --url "URL" --title "Title" --artist "Artist"');
      console.error('  npm run ingest:youtube -- --file songs.json');
      process.exit(1);
    }
  }

  return songs;
}

async function main() {
  const songs = parseArgs();

  if (songs.length === 0) {
    console.error('No songs specified. Use --url or --file.');
    console.error('');
    console.error('Examples:');
    console.error('  npm run ingest:youtube -- --url "https://youtube.com/watch?v=..." --title "Amazing Grace" --artist "Traditional"');
    console.error('  npm run ingest:youtube -- --file backend/scripts/worship-songs.json');
    process.exit(1);
  }

  console.log(`Starting YouTube ingestion for ${songs.length} song(s)...\n`);
  console.log(`CREPE service: ${embeddingServiceUrl}`);
  console.log(`Supabase: ${supabaseUrl}\n`);

  let success = 0;
  let failed = 0;

  for (const song of songs) {
    const ok = await processSong(song);
    if (ok) success++;
    else failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('Ingestion Summary');
  console.log('='.repeat(60));
  console.log(`  Processed: ${songs.length}`);
  console.log(`  Success:   ${success}`);
  console.log(`  Failed:    ${failed}`);
  console.log('\nDone!');

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
