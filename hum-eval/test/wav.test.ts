import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeWav16Mono, encodeWav16Mono, resampleLinear } from '../src/wav.ts';

test('WAV encode/decode roundtrip preserves samples', () => {
  const sampleRate = 16000;
  const n = 16000;
  const sine = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sine[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
  }
  const encoded = encodeWav16Mono(sine, sampleRate);
  const decoded = decodeWav16Mono(encoded);
  assert.equal(decoded.sampleRate, sampleRate);
  assert.equal(decoded.samples.length, n);
  let maxErr = 0;
  for (let i = 0; i < n; i++) {
    maxErr = Math.max(maxErr, Math.abs(decoded.samples[i] - sine[i]));
  }
  assert.ok(maxErr < 1 / 32000, `max quantization error ${maxErr}`);
});

test('decode rejects non-WAV data', () => {
  assert.throws(() => decodeWav16Mono(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])));
});

test('resampleLinear 48k→16k produces 1/3 length and preserves a low tone', () => {
  const from = 48000;
  const to = 16000;
  const seconds = 0.5;
  const src = new Float32Array(from * seconds);
  for (let i = 0; i < src.length; i++) {
    src[i] = Math.sin((2 * Math.PI * 200 * i) / from);
  }
  const out = resampleLinear(src, from, to);
  assert.equal(out.length, Math.floor(src.length / 3));
  // The resampled signal should still be a ~200Hz tone: check a few samples
  // against the analytically expected values.
  for (const i of [100, 1000, 4000]) {
    const expected = Math.sin((2 * Math.PI * 200 * i) / to);
    assert.ok(Math.abs(out[i] - expected) < 0.02, `sample ${i} off by ${Math.abs(out[i] - expected)}`);
  }
});
