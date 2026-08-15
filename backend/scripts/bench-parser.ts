/**
 * Run the REAL Bible reference parser (the Whisper-net path: shouldTrigger + parseForProject)
 * over a timestamped transcript, to measure recall — which references Option A would catch/project.
 *
 * Usage: tsx backend/scripts/bench-parser.ts <transcript.txt>
 */
import fs from 'fs';
import { initBibleReferenceParser, shouldTrigger, parseForProject } from '../src/services/bibleReferenceParser';

async function main(): Promise<void> {
  await initBibleReferenceParser();
  const file = process.argv[2];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let triggers = 0;
  let projects = 0;
  for (const line of lines) {
    const ts = (line.match(/^\[\d+:\d+\]/) || [''])[0];
    const text = line.replace(/^\[\d+:\d+\]\s*/, '').trim();
    if (!text) continue;
    const trig = shouldTrigger(text);
    const proj = parseForProject(text);
    if (trig || proj) {
      if (trig) triggers++;
      if (proj) projects++;
      const ref = proj ? `${proj.book} ${proj.chapter}:${proj.verse}` : '-';
      console.log(`${ts} trigger=${trig ? 'Y' : 'n'} project=${ref.padEnd(20)} :: ${text.slice(0, 70)}`);
    }
  }
  console.log(`\n[bench-parser] windows that would TRIGGER a window: ${triggers}; that would PROJECT a verse: ${projects}`);
}

void main();
