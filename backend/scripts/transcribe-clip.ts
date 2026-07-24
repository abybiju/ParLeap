/**
 * Transcribe short (<=30s) 16k-mono wav clips with the sherpa Whisper model — bench helper to
 * check what was actually said around a wake. Imports no app modules.
 *
 * Usage: tsx backend/scripts/transcribe-clip.ts <whisperModelsDir> <model> <clip.wav> [clip.wav...]
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
const clips = process.argv.slice(4);

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

for (const clip of clips) {
  const samples = readWav16kMono(clip);
  const stream = rec.createStream();
  stream.acceptWaveform({ sampleRate: 16000, samples });
  rec.decode(stream);
  const text = (rec.getResult(stream).text || '').trim();
  console.log(`${path.basename(clip)}: ${text}`);
}
