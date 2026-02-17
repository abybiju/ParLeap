/**
 * Audio Ingestion Script
 *
 * Processes WAV files from songs_input/ and extracts vectors for Hum-to-Search.
 * - Always: BasicPitch melody vector (128D) → melody_vector.
 * - When EMBEDDING_SERVICE_URL is set: also POSTs WAV to embedding service → embedding (768D).
 *
 * Usage:
 *   npm run ingest
 *
 * Requirements:
 *   - WAV files in backend/songs_input/
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *   - Optional: EMBEDDING_SERVICE_URL for YouTube-style 768D embeddings
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import { createClient } from '@supabase/supabase-js';
import { getMelodyVectorFromFile } from '../src/services/melodyService';
import { getEmbeddingFromService } from '../src/services/humSearchService';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const embeddingServiceUrl = (process.env.EMBEDDING_SERVICE_URL || '').trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Extract title and artist from filename
 * Examples:
 *   "Way-Maker-Sinach.wav" -> { title: "Way Maker", artist: "Sinach" }
 *   "Amazing-Grace-Traditional.wav" -> { title: "Amazing Grace", artist: "Traditional" }
 */
function parseFilename(filename: string): { title: string; artist: string } {
  // Remove extension
  const nameWithoutExt = path.basename(filename, path.extname(filename));
  
  // Split by hyphens or underscores
  const parts = nameWithoutExt.split(/[-_]/);
  
  if (parts.length === 1) {
    // Just title, no artist
    return { title: parts[0], artist: 'Unknown' };
  }
  
  // Last part is usually artist, rest is title
  const artist = parts[parts.length - 1];
  const title = parts.slice(0, -1).join(' ');
  
  return { title, artist };
}

/**
 * Process a single WAV file
 */
async function processFile(filePath: string): Promise<void> {
  const filename = path.basename(filePath);
  const { title, artist } = parseFilename(filename);
  
  console.log(`\n🎵 Processing: ${filename}`);
  console.log(`   Title: ${title}`);
  console.log(`   Artist: ${artist}`);
  
  try {
    // Extract melody vector (128D, for match_songs when embedding service not used)
    console.log('   Extracting melody vector...');
    const melodyVector = await getMelodyVectorFromFile(filePath);

    if (melodyVector.length !== 128) {
      throw new Error(`Invalid vector length: expected 128, got ${melodyVector.length}`);
    }

    console.log(`   ✅ Extracted ${melodyVector.length}D melody vector`);

    let embedding: number[] | undefined;
    if (embeddingServiceUrl) {
      console.log('   Calling embedding service (YouTube-style)...');
      const buffer = fs.readFileSync(filePath);
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          embedding = await getEmbeddingFromService(buffer);
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (attempt < maxRetries) {
            const delay = attempt * 5000;
            console.log(`   ⚠️  Embedding attempt ${attempt}/${maxRetries} failed (${msg}), retrying in ${delay / 1000}s...`);
            await new Promise((r) => setTimeout(r, delay));
          } else {
            throw err;
          }
        }
      }
      if (embedding && embedding.length !== 768) {
        throw new Error(`Invalid embedding length: expected 768, got ${embedding.length}`);
      }
      if (embedding) {
        console.log(`   ✅ Got ${embedding.length}D embedding`);
      }
    }

    const row: Record<string, unknown> = {
      melody_vector: melodyVector,
      source: 'manual',
    };
    if (embedding) {
      row.embedding = embedding;
    }

    // Check if fingerprint already exists
    const { data: existing } = await supabase
      .from('song_fingerprints')
      .select('id')
      .eq('title', title)
      .eq('artist', artist)
      .single();

    if (existing) {
      console.log(`   ⚠️  Fingerprint already exists, updating...`);
      const { error: updateError } = await supabase
        .from('song_fingerprints')
        .update(row)
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }
      console.log(`   ✅ Updated existing fingerprint`);
    } else {
      const { error: insertError } = await supabase.from('song_fingerprints').insert({
        title,
        artist,
        ...row,
      });

      if (insertError) {
        throw insertError;
      }
      console.log(`   ✅ Inserted new fingerprint`);
    }
  } catch (error) {
    console.error(`   ❌ Error processing ${filename}:`, error);
    throw error;
  }
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('🚀 Starting audio ingestion...\n');
  
  // Find songs_input directory
  const songsInputDir = path.join(__dirname, '../songs_input');
  
  if (!fs.existsSync(songsInputDir)) {
    console.error(`❌ Error: Directory not found: ${songsInputDir}`);
    console.error('   Please create backend/songs_input/ and add WAV files');
    process.exit(1);
  }
  
  // Find all WAV files
  const pattern = path.join(songsInputDir, '**/*.wav');
  const files = await glob(pattern, { absolute: true });
  
  if (files.length === 0) {
    console.warn(`⚠️  No WAV files found in ${songsInputDir}`);
    console.warn('   Please add .wav files to process');
    process.exit(0);
  }
  
  console.log(`📁 Found ${files.length} WAV file(s) to process\n`);
  
  // Process each file
  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ file: string; error: string }>,
  };
  
  for (const file of files) {
    try {
      await processFile(file);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        file: path.basename(file),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Ingestion Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successfully processed: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`);
    });
  }
  
  console.log('\n✨ Done!');
  
  if (results.failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
