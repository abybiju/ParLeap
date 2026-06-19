/**
 * Standalone Phase C detector smoke test.
 * Streams a real sermon clip through createBibleTriggerDetector and reports triggers.
 *
 * Usage:
 *   BIBLE_DETECTOR_MODELS_DIR=/tmp/bible_detector_models BIBLE_DETECTOR_MODEL=tiny.en \
 *     npx tsx scripts/test-bible-detector.ts [clip.wav]
 */
import path from 'path';
import fs from 'fs';
import { createBibleTriggerDetector } from '../src/services/bibleTriggerService';

const MODELS_DIR = process.env.BIBLE_DETECTOR_MODELS_DIR || '/tmp/bible_detector_models';
const MODEL = process.env.BIBLE_DETECTOR_MODEL || 'tiny.en';
const CLIPS = ['s1_acts9', 's1_galatians', 's1_john31610', 's2_acts_nine'].map(
  (n) => `/tmp/parleap_sermon_test/${n}_16k.wav`
);

function readWavPcmBytes(p: string): Buffer {
  const buf = fs.readFileSync(p);
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const sz = buf.readUInt32LE(off + 4);
    if (id === 'data') return buf.subarray(off + 8, off + 8 + sz);
    off += 8 + sz + (sz % 2);
  }
  throw new Error('no data chunk in ' + p);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runClip(clip: string): Promise<number> {
  let count = 0;
  const det = createBibleTriggerDetector({
    sessionId: 'test',
    eventId: 'test-event',
    model: MODEL,
    modelsDir: MODELS_DIR,
    onTrigger: (catchUp) => {
      count++;
      console.log(`  >>> TRIGGER, catch-up ${Buffer.from(catchUp, 'base64').length} bytes`);
    },
  });
  await sleep(800); // let the worker load the model

  const pcm = readWavPcmBytes(clip);
  console.log(`\n=== ${path.basename(clip)} (${(pcm.length / 32000).toFixed(1)}s) ===`);
  const CHUNK = 4096; // ~128ms
  for (let i = 0; i < pcm.length; i += CHUNK) {
    det.feed(pcm.subarray(i, i + CHUNK).toString('base64'));
    await sleep(4);
  }
  await sleep(4000); // drain inference
  det.stop();
  console.log(`  triggers: ${count}`);
  return count;
}

(async () => {
  let total = 0;
  for (const clip of CLIPS) total += await runClip(clip);
  console.log(`\nTOTAL TRIGGERS across ${CLIPS.length} clips: ${total}`);
  process.exit(total > 0 ? 0 : 1);
})();
