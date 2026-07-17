/** Minimal 16-bit PCM WAV encode/decode + linear resampling. */

export interface WavData {
  sampleRate: number;
  samples: Float32Array;
}

/** Decode a mono 16-bit PCM WAV file. Throws on unsupported formats. */
export function decodeWav16Mono(buf: Uint8Array): WavData {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (off: number) =>
    String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));

  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file');

  let sampleRate = 0;
  let numChannels = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  let off = 12;
  while (off + 8 <= view.byteLength) {
    const chunkId = tag(off);
    const chunkSize = view.getUint32(off + 4, true);
    if (chunkId === 'fmt ') {
      const audioFormat = view.getUint16(off + 8, true);
      numChannels = view.getUint16(off + 10, true);
      sampleRate = view.getUint32(off + 12, true);
      bitsPerSample = view.getUint16(off + 22, true);
      if (audioFormat !== 1) throw new Error(`Unsupported WAV format ${audioFormat} (need PCM)`);
    } else if (chunkId === 'data') {
      dataOffset = off + 8;
      dataLength = chunkSize;
    }
    off += 8 + chunkSize + (chunkSize % 2);
  }

  if (dataOffset === -1) throw new Error('WAV has no data chunk');
  if (bitsPerSample !== 16) throw new Error(`Unsupported bit depth ${bitsPerSample} (need 16)`);
  if (numChannels !== 1) throw new Error(`Unsupported channel count ${numChannels} (need mono)`);

  const n = Math.floor(dataLength / 2);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
  }
  return { sampleRate, samples };
}

/** Encode mono float samples as a 16-bit PCM WAV file. */
export function encodeWav16Mono(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataLength = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buf);
  const writeTag = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeTag(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeTag(8, 'WAVE');
  writeTag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeTag(36, 'data');
  view.setUint32(40, dataLength, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }
  return new Uint8Array(buf);
}

/** Linear-interpolation resampler (adequate for 48k→16k hum audio). */
export function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) return samples;
  const outLength = Math.floor((samples.length * toRate) / fromRate);
  const out = new Float32Array(outLength);
  const ratio = fromRate / toRate;
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, samples.length - 1);
    out[i] = samples[lo] + (samples[hi] - samples[lo]) * (pos - lo);
  }
  return out;
}
