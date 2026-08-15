/**
 * Isolation harness for the wake-word detector (bibleTriggerService + worker), KWS-only.
 *
 * Spawns the real detector with whisperNet=false (no Whisper models needed), streams a wav
 * in as base64 PCM chunks, and asserts onTrigger fires from a spotted scripture cue.
 *
 * Usage:
 *   tsx backend/scripts/test-wake-detector.ts <kwsModelDir> <keywordsFile> <wav>
 */
import fs from 'fs';
import { createBibleTriggerDetector } from '../src/services/bibleTriggerService';

function readWavData(file: string): Buffer {
  const buf = fs.readFileSync(file);
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') return buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size & 1);
  }
  throw new Error(`${file}: no data chunk`);
}

const [kwsModelDir, keywordsFile, wav] = process.argv.slice(2);
if (!kwsModelDir || !keywordsFile || !wav) {
  console.error('usage: tsx backend/scripts/test-wake-detector.ts <kwsModelDir> <keywordsFile> <wav>');
  process.exit(2);
}

let fired = false;
const detector = createBibleTriggerDetector({
  sessionId: 'test-session',
  eventId: 'test-event-0001',
  whisperNet: process.env.WHISPER_NET === 'true', // set WHISPER_NET=true to also boot the Whisper net
  kwsModelsDir: kwsModelDir,
  kwsKeywordsFile: keywordsFile,
  onTrigger: (catchUpBase64) => {
    fired = true;
    const bytes = Buffer.from(catchUpBase64, 'base64').length;
    console.log(`[harness] ✅ onTrigger fired — catch-up ${bytes} bytes`);
  },
});

// Stream the wav in ~100ms PCM chunks (3200 bytes = 1600 samples @16k s16le).
const data = readWavData(wav);
const CHUNK = 3200;
for (let i = 0; i < data.length; i += CHUNK) {
  detector.feed(data.subarray(i, i + CHUNK).toString('base64'));
}
console.log(`[harness] fed ${(data.length / 32000).toFixed(1)}s of audio; awaiting worker…`);

setTimeout(() => {
  detector.stop();
  console.log(`[harness] result: fired=${fired}`);
  process.exit(fired ? 0 : 1);
}, 3000);
