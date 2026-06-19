/**
 * Smart Bible Listen — detector worker thread (minimal, native-only).
 *
 * Runs ONLY the heavy native work — Silero VAD utterance segmentation + Whisper transcription —
 * off the WS event loop, so a native crash is isolated and inference never blocks the server.
 * It posts each finalized segment's TEXT to the main thread; the lightweight shouldTrigger()
 * decision (and the catch-up ring buffer) live on the main thread in bibleTriggerService.ts.
 * The worker deliberately imports NO app modules — only the sherpa-onnx native addon.
 */
import { parentPort, workerData } from 'worker_threads';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sherpa = require('sherpa-onnx-node');

interface WorkerData {
  model: string; // 'base.en' | 'small.en' | 'tiny.en'
  modelsDir: string;
  vadPath?: string;
  vadThreshold?: number;
}

const cfg = workerData as WorkerData;
const model = cfg.model || 'base.en';
const modelsDir = cfg.modelsDir;
const vadPath = cfg.vadPath || path.join(modelsDir, 'silero_vad.onnx');
const VAD_THRESHOLD = cfg.vadThreshold ?? 0.35;
const VAD_WINDOW = 512; // ~32ms frames at 16k

function post(msg: unknown): void {
  parentPort?.postMessage(msg);
}

// Minimal typings for the sherpa-onnx native addon surface we use (it ships no .d.ts).
interface SherpaStream {
  acceptWaveform(o: { sampleRate: number; samples: Float32Array }): void;
}
interface SherpaRecognizer {
  createStream(): SherpaStream;
  decode(s: SherpaStream): void;
  getResult(s: SherpaStream): { text: string };
}
interface SherpaSegment {
  start: number;
  samples: Float32Array | number[];
}
interface SherpaVad {
  acceptWaveform(s: Float32Array): void;
  isEmpty(): boolean;
  front(): SherpaSegment;
  pop(): void;
  flush(): void;
}

let recognizer: SherpaRecognizer;
let vad: SherpaVad;
try {
  recognizer = new sherpa.OfflineRecognizer({
    modelConfig: {
      whisper: {
        encoder: path.join(modelsDir, `${model}-encoder.int8.onnx`),
        decoder: path.join(modelsDir, `${model}-decoder.int8.onnx`),
      },
      tokens: path.join(modelsDir, `${model}-tokens.txt`),
      numThreads: 1,
      provider: 'cpu',
      debug: false,
    },
  });
  vad = new sherpa.Vad(
    {
      sileroVad: {
        model: vadPath,
        threshold: VAD_THRESHOLD,
        minSilenceDuration: 0.5,
        minSpeechDuration: 0.25,
        windowSize: VAD_WINDOW,
        maxSpeechDuration: 5,
      },
      sampleRate: 16000,
      numThreads: 1,
      debug: false,
    },
    30 // VAD-internal ring buffer seconds
  );
} catch (err) {
  post({ type: 'error', message: `init failed: ${(err as Error).message}` });
  throw err;
}

function transcribe(samples: Float32Array): string {
  const stream = recognizer.createStream();
  stream.acceptWaveform({ sampleRate: 16000, samples });
  recognizer.decode(stream);
  return (recognizer.getResult(stream).text || '').trim();
}

function drainSegments(): void {
  while (!vad.isEmpty()) {
    const seg = vad.front();
    vad.pop();
    try {
      const text = transcribe(Float32Array.from(seg.samples));
      if (text) post({ type: 'segment', text, start: seg.start });
    } catch (err) {
      post({ type: 'error', message: `transcribe failed: ${(err as Error).message}` });
    }
  }
}

let leftover = new Float32Array(0);

function feedPcm(b64: string): void {
  const buf = Buffer.from(b64, 'base64');
  const n = buf.length >> 1;
  const merged = new Float32Array(leftover.length + n);
  merged.set(leftover, 0);
  for (let i = 0; i < n; i++) merged[leftover.length + i] = buf.readInt16LE(i * 2) / 32768;

  let off = 0;
  for (; off + VAD_WINDOW <= merged.length; off += VAD_WINDOW) {
    vad.acceptWaveform(merged.subarray(off, off + VAD_WINDOW));
  }
  leftover = merged.slice(off);
  drainSegments();
}

post({ type: 'ready', model });

parentPort?.on('message', (msg: { type: string; b64?: string }) => {
  if (msg.type === 'audio' && msg.b64) {
    try {
      feedPcm(msg.b64);
    } catch (err) {
      post({ type: 'error', message: `feed failed: ${(err as Error).message}` });
    }
  } else if (msg.type === 'flush') {
    try {
      vad.flush();
      drainSegments();
    } catch {
      // ignore
    }
  } else if (msg.type === 'stop') {
    parentPort?.close();
  }
});
