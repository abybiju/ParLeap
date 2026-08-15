/**
 * Smart Bible Listen — detector worker thread (minimal, native-only).
 *
 * Runs the heavy native work off the WS event loop:
 *   - sherpa KeywordSpotter (ALWAYS): streaming wake-phrase detection on scripture cues
 *     ("turn to…", "open your bibles to…") → posts {type:'keyword'}. Near-zero CPU.
 *   - Silero VAD + Whisper (OPTIONAL, BIBLE_DETECTOR_WHISPER_NET): transcribes each
 *     finalized utterance and posts {type:'segment'} as the un-cued safety net (Option A).
 *
 * The lightweight decisions (shouldTrigger, cooldown, catch-up ring) live on the main
 * thread in bibleTriggerService.ts. The worker imports NO app modules — only the addon.
 */
import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sherpa = require('sherpa-onnx-node');

interface WorkerData {
  model: string; // whisper: 'base.en' | 'small.en' | 'tiny.en'
  modelsDir: string; // whisper + vad models
  vadPath?: string;
  vadThreshold?: number;
  whisperNet?: boolean; // default true (Option A: keep the un-cued net on)
  kwsModelsDir?: string; // keyword-spotter model dir (defaults to modelsDir)
  kwsKeywordsFile?: string; // tokenized keywords.txt (defaults to <kwsModelsDir>/keywords.txt)
  kwsThreshold?: number;
  kwsScore?: number;
}

const cfg = workerData as WorkerData;
const model = cfg.model || 'base.en';
const modelsDir = cfg.modelsDir;
const vadPath = cfg.vadPath || path.join(modelsDir, 'silero_vad.onnx');
const VAD_THRESHOLD = cfg.vadThreshold ?? 0.35;
const VAD_WINDOW = 512; // ~32ms frames at 16k
const whisperNet = cfg.whisperNet !== false;

function post(msg: unknown): void {
  parentPort?.postMessage(msg);
}

function findModelFile(dir: string, re: RegExp): string {
  const f = fs.readdirSync(dir).find((n) => re.test(n));
  if (!f) throw new Error(`no file matching ${re} in ${dir}`);
  return path.join(dir, f);
}

// Minimal typings for the sherpa-onnx native addon surface we use (it ships no .d.ts).
interface SherpaStream {
  acceptWaveform(o: { sampleRate: number; samples: Float32Array }): void;
  inputFinished?(): void;
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
interface SherpaKws {
  createStream(): SherpaStream;
  isReady(s: SherpaStream): boolean;
  decode(s: SherpaStream): void;
  getResult(s: SherpaStream): { keyword: string };
  reset(s: SherpaStream): void;
}

// ---- Keyword spotter (always on — the primary wake) ----
let kws: SherpaKws;
let kwsStream: SherpaStream;
try {
  const kwsDir = cfg.kwsModelsDir || modelsDir;
  kws = new sherpa.KeywordSpotter({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: findModelFile(kwsDir, /encoder.*\.int8\.onnx$/),
        decoder: findModelFile(kwsDir, /decoder.*\.int8\.onnx$/),
        joiner: findModelFile(kwsDir, /joiner.*\.int8\.onnx$/),
      },
      tokens: path.join(kwsDir, 'tokens.txt'),
      numThreads: 1,
      provider: 'cpu',
      debug: false,
    },
    keywordsFile: cfg.kwsKeywordsFile || path.join(kwsDir, 'keywords.txt'),
    keywordsThreshold: cfg.kwsThreshold ?? 0.25,
    keywordsScore: cfg.kwsScore ?? 1.5,
  });
  kwsStream = kws.createStream();
} catch (err) {
  post({ type: 'error', message: `kws init failed: ${(err as Error).message}` });
  throw err;
}

// ---- VAD + Whisper (optional un-cued safety net) ----
let recognizer: SherpaRecognizer | undefined;
let vad: SherpaVad | undefined;
if (whisperNet) {
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
    post({ type: 'error', message: `whisper/vad init failed: ${(err as Error).message}` });
    throw err;
  }
}

function transcribe(samples: Float32Array): string {
  if (!recognizer) return '';
  const stream = recognizer.createStream();
  stream.acceptWaveform({ sampleRate: 16000, samples });
  recognizer.decode(stream);
  return (recognizer.getResult(stream).text || '').trim();
}

function drainWhisper(): void {
  if (!vad || !recognizer) return;
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

function drainKws(): void {
  while (kws.isReady(kwsStream)) {
    kws.decode(kwsStream);
    const r = kws.getResult(kwsStream);
    if (r && r.keyword && r.keyword !== '') {
      post({ type: 'keyword', keyword: r.keyword });
      kws.reset(kwsStream); // one wake per phrase; the main thread enforces cooldown
    }
  }
}

let leftover = new Float32Array(0);

function feedPcm(b64: string): void {
  const buf = Buffer.from(b64, 'base64');
  const n = buf.length >> 1;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = buf.readInt16LE(i * 2) / 32768;

  // KWS is streaming and accepts arbitrary chunk sizes.
  kwsStream.acceptWaveform({ sampleRate: 16000, samples });
  drainKws();

  // Whisper net: Silero VAD wants fixed 512-sample frames.
  if (whisperNet && vad) {
    const merged = new Float32Array(leftover.length + n);
    merged.set(leftover, 0);
    merged.set(samples, leftover.length);
    let off = 0;
    for (; off + VAD_WINDOW <= merged.length; off += VAD_WINDOW) {
      vad.acceptWaveform(merged.subarray(off, off + VAD_WINDOW));
    }
    leftover = merged.slice(off);
    drainWhisper();
  }
}

post({ type: 'ready', model, whisperNet });

parentPort?.on('message', (msg: { type: string; b64?: string }) => {
  if (msg.type === 'audio' && msg.b64) {
    try {
      feedPcm(msg.b64);
    } catch (err) {
      post({ type: 'error', message: `feed failed: ${(err as Error).message}` });
    }
  } else if (msg.type === 'flush') {
    try {
      kwsStream.inputFinished?.();
      drainKws();
      if (whisperNet && vad) {
        vad.flush();
        drainWhisper();
      }
    } catch {
      // ignore
    }
  } else if (msg.type === 'stop') {
    parentPort?.close();
  }
});
