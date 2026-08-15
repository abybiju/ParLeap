/**
 * Transcribe a long 16k-mono wav in 30s windows (2s overlap) with sherpa Whisper — bench helper
 * to build a timestamped transcript for ground-truthing recall. Imports no app modules.
 *
 * Usage: tsx backend/scripts/transcribe-full.ts <whisperModelsDir> <model> <wav>
 */
/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'fs';
import path from 'path';

const sherpa = require('sherpa-onnx-node');

function readWav16kMono(file: string): Float32Array {
  const buf = fs.readFileSync(file);
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') {
      const n = Math.floor(size / 2);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(off + 8 + i * 2) / 32768;
      return out;
    }
    off += 8 + size + (size & 1);
  }
  throw new Error(`${file}: no data chunk`);
}

const modelsDir = process.argv[2];
const model = process.argv[3] || 'base.en';
const wav = process.argv[4];

const rec = new sherpa.OfflineRecognizer({
  modelConfig: {
    whisper: {
      encoder: path.join(modelsDir, `${model}-encoder.int8.onnx`),
      decoder: path.join(modelsDir, `${model}-decoder.int8.onnx`),
    },
    tokens: path.join(modelsDir, `${model}-tokens.txt`),
    numThreads: 2,
    provider: 'cpu',
    debug: false,
  },
});

const samples = readWav16kMono(wav);
const WIN = 30 * 16000;
const HOP = 28 * 16000; // 2s overlap so a reference at a window edge isn't split
for (let start = 0; start < samples.length; start += HOP) {
  const seg = samples.subarray(start, Math.min(start + WIN, samples.length));
  const stream = rec.createStream();
  stream.acceptWaveform({ sampleRate: 16000, samples: seg });
  rec.decode(stream);
  const text = (rec.getResult(stream).text || '').trim();
  const t = start / 16000;
  const mm = Math.floor(t / 60);
  const ss = Math.floor(t % 60);
  if (text) console.log(`[${mm}:${String(ss).padStart(2, '0')}] ${text}`);
}
