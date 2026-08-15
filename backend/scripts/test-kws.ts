/**
 * Isolated smoke test for sherpa-onnx-node KeywordSpotter (Smart Bible wake word).
 *
 * Proves the keyword-spotter engine loads and fires on the given keywords for the given wav(s).
 * Imports no app modules — only the native addon + fs. Mirrors backend/scripts/test-bible-detector.ts.
 *
 * Usage:
 *   tsx backend/scripts/test-kws.ts <modelDir> <keywordsFile> <wav> [wav...]
 */
/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'fs';
import path from 'path';

const sherpa = require('sherpa-onnx-node');

/** Read a 16 kHz mono PCM_S16LE wav into Float32 [-1,1], scanning for the `data` chunk. */
function readWav16kMono(file: string): Float32Array {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${file}: not a RIFF/WAVE file`);
  }
  let off = 12;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') {
      dataOff = off + 8;
      dataLen = size;
      break;
    }
    off += 8 + size + (size & 1); // chunks are word-aligned
  }
  if (dataOff < 0) throw new Error(`${file}: no data chunk`);
  const n = Math.floor(dataLen / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(dataOff + i * 2) / 32768;
  return out;
}

function findModelFile(dir: string, re: RegExp): string {
  const f = fs.readdirSync(dir).find((n) => re.test(n));
  if (!f) throw new Error(`no file matching ${re} in ${dir}`);
  return path.join(dir, f);
}

const modelDir = process.argv[2];
const keywordsFile = process.argv[3];
const wavs = process.argv.slice(4);
if (!modelDir || !keywordsFile || wavs.length === 0) {
  console.error('usage: tsx backend/scripts/test-kws.ts <modelDir> <keywordsFile> <wav> [wav...]');
  process.exit(2);
}

const encoder = findModelFile(modelDir, /encoder.*\.int8\.onnx$/);
const decoder = findModelFile(modelDir, /decoder.*\.int8\.onnx$/);
const joiner = findModelFile(modelDir, /joiner.*\.int8\.onnx$/);
console.log(`[kws] model: ${path.basename(modelDir)}`);
console.log(`[kws] keywords: ${keywordsFile}`);

const t0 = Date.now();
const spotter = new sherpa.KeywordSpotter({
  featConfig: { sampleRate: 16000, featureDim: 80 },
  modelConfig: {
    transducer: { encoder, decoder, joiner },
    tokens: path.join(modelDir, 'tokens.txt'),
    numThreads: 1,
    provider: 'cpu',
    debug: false,
  },
  keywordsFile,
  keywordsThreshold: 0.25,
  keywordsScore: 1.5,
});
console.log(`[kws] spotter loaded in ${Date.now() - t0}ms\n`);

let total = 0;
for (const wav of wavs) {
  const samples = readWav16kMono(wav);
  const stream = spotter.createStream();
  // Feed in realistic ~100ms chunks, decoding as frames become ready (streaming behaviour).
  const CHUNK = 1600;
  const hits: string[] = [];
  let pos = 0;
  const drain = () => {
    while (spotter.isReady(stream)) {
      spotter.decode(stream);
      const r = spotter.getResult(stream);
      if (r && r.keyword && r.keyword !== '') {
        const t = pos / 16000;
        const mm = Math.floor(t / 60);
        const ss = Math.floor(t % 60);
        hits.push(`${r.keyword}@${mm}:${String(ss).padStart(2, '0')}`);
        spotter.reset(stream);
      }
    }
  };
  for (let i = 0; i < samples.length; i += CHUNK) {
    pos = Math.min(i + CHUNK, samples.length);
    stream.acceptWaveform({ sampleRate: 16000, samples: samples.subarray(i, i + CHUNK) });
    drain();
  }
  stream.acceptWaveform({ sampleRate: 16000, samples: new Float32Array(8000) }); // tail
  stream.inputFinished();
  drain();
  total += hits.length;
  console.log(`${path.basename(wav)} (${(samples.length / 16000).toFixed(1)}s) -> ${hits.length} hit(s): ${JSON.stringify(hits)}`);
}
console.log(`\n[kws] total hits across ${wavs.length} file(s): ${total}`);
