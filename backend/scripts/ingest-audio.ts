/**
 * Audio Ingestion Script
 * 
 * Processes WAV files from songs_input/ directory and extracts melody vectors
 * for the "Hum-to-Search" feature.
 * 
 * Usage:
 *   npm run ingest
 * 
 * Requirements:
 *   - WAV files in backend/songs_input/
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import { createClient } from '@supabase/supabase-js';
import { getMelodyVectorFromFile } from '../src/services/melodyService';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    // Extract melody vector
    console.log('   Extracting melody vector...');
    const melodyVector = await getMelodyVectorFromFile(filePath);
    
    if (melodyVector.length !== 128) {
      throw new Error(`Invalid vector length: expected 128, got ${melodyVector.length}`);
    }
    
    console.log(`   ✅ Extracted ${melodyVector.length}D vector`);
    
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
        .update({
          melody_vector: melodyVector,
          source: 'manual',
        })
        .eq('id', existing.id);
      
      if (updateError) {
        throw updateError;
      }
      console.log(`   ✅ Updated existing fingerprint`);
    } else {
      // Insert new fingerprint
      const { error: insertError } = await supabase
        .from('song_fingerprints')
        .insert({
          title,
          artist,
          melody_vector: melodyVector,
          source: 'manual',
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
