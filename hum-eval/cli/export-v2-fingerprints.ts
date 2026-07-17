/**
 * Export the v2 interval-sequence fingerprints from Supabase into a local
 * catalog JSON for the v2 baseline matcher.
 *
 * Usage (reads backend/.env for SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   node cli/export-v2-fingerprints.ts [--out testset/v2-fingerprints.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../backend/.env') });

const { values } = parseArgs({
  options: { out: { type: 'string', default: 'testset/v2-fingerprints.json' } },
});

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found (looked in backend/.env)');
  process.exit(2);
}

const supabase = createClient(url, key);
const { data, error } = await supabase
  .from('song_fingerprints')
  .select('id, song_id, title, artist, interval_sequence')
  .not('interval_sequence', 'is', null);

if (error) {
  console.error('Supabase query failed:', error.message);
  process.exit(1);
}

const catalog = (data ?? []).map((row) => ({
  songId: row.song_id ?? row.id,
  title: row.artist ? `${row.title} — ${row.artist}` : row.title,
  intervals: row.interval_sequence as number[],
}));

const outPath = path.resolve(values.out!);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2));
console.log(`Exported ${catalog.length} v2 fingerprints to ${values.out}`);
