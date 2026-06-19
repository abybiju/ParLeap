/**
 * Smart Bible Listen — backend always-on detector (main-thread façade).
 *
 * Per live Bible-mode session, this owns:
 *  - a worker_thread running Silero VAD + Whisper that calls shouldTrigger() (bibleTriggerWorker),
 *  - a ~30s ring buffer of raw PCM used as "catch-up" audio so the ElevenLabs burst captures the
 *    reference from its onset (the worker only decides WHEN to open the window).
 *
 * On a worker trigger it invokes onTrigger(catchUpBase64); the caller (handler) opens the
 * ElevenLabs window and flushes that catch-up audio. Detector text never leaves the backend.
 */
import { Worker } from 'worker_threads';
import path from 'path';
import { shouldTrigger, initBibleReferenceParser } from './bibleReferenceParser';

// Load the phonetic gate once for the whole process; shouldTrigger degrades gracefully until ready.
void initBibleReferenceParser();

export interface BibleTriggerDetector {
  /** Feed one base64 PCM (pcm_s16le 16k mono) chunk from the live stream. */
  feed(pcmBase64: string): void;
  /** Tear down the worker + buffers. */
  stop(): void;
}

export interface BibleTriggerOptions {
  sessionId: string;
  eventId: string;
  /** Called when a probable reference is heard; arg is base64 catch-up PCM to seed the burst. */
  onTrigger: (catchUpAudioBase64: string) => void;
  model?: string;
  modelsDir?: string;
}

/** 30s of 16k mono s16le. */
const RING_MAX_BYTES = 16000 * 2 * 30;
/** Don't hand the caller triggers faster than this; the handler also enforces a per-reference cooldown. */
const MIN_TRIGGER_GAP_MS = 2000;
/** shouldTrigger() sees a short rolling word window so a reference spanning segments still fires. */
const ROLLING_WORDS = 20;

const DEFAULT_MODEL = process.env.BIBLE_DETECTOR_MODEL || 'base.en';
const DEFAULT_MODELS_DIR = process.env.BIBLE_DETECTOR_MODELS_DIR || path.resolve(process.cwd(), 'models');

export function createBibleTriggerDetector(opts: BibleTriggerOptions): BibleTriggerDetector {
  const ring: Buffer[] = [];
  let ringBytes = 0;
  let stopped = false;
  let lastTriggerAt = 0;
  let rolling: string[] = [];

  const isTs = __filename.endsWith('.ts');
  const workerPath = path.resolve(__dirname, `bibleTriggerWorker${isTs ? '.ts' : '.js'}`);
  const worker = new Worker(workerPath, {
    workerData: {
      model: opts.model || DEFAULT_MODEL,
      modelsDir: opts.modelsDir || DEFAULT_MODELS_DIR,
      vadThreshold: process.env.BIBLE_DETECTOR_VAD_THRESHOLD ? Number(process.env.BIBLE_DETECTOR_VAD_THRESHOLD) : undefined,
    },
    // Under tsx (dev) the worker is a .ts file loaded in CJS mode; in prod it is compiled .js.
    ...(isTs ? { execArgv: ['--require', 'tsx/cjs'] } : {}),
  });

  worker.on('message', (msg: { type: string; text?: string; message?: string; model?: string }) => {
    if (stopped) return;
    if (msg.type === 'segment' && msg.text) {
      // Lightweight decision runs on the main thread; the worker only does heavy native ASR/VAD.
      const words = msg.text.split(/\s+/).filter(Boolean);
      if (words.length === 0) return;
      rolling.push(...words);
      if (rolling.length > ROLLING_WORDS) rolling = rolling.slice(-ROLLING_WORDS);
      if (rolling.length < 2) return; // ignore lone words (cuts music false-opens)
      const windowText = rolling.join(' ');
      if (!shouldTrigger(windowText)) return;
      const now = Date.now();
      if (now - lastTriggerAt < MIN_TRIGGER_GAP_MS) return;
      lastTriggerAt = now;
      rolling = []; // reset so the same phrase does not immediately re-fire
      const catchUp = Buffer.concat(ring).toString('base64');
      console.log(`[bibleTrigger] ${opts.eventId.slice(0, 8)} triggered on: "${windowText}" (catch-up ${ringBytes} bytes)`);
      opts.onTrigger(catchUp);
    } else if (msg.type === 'ready') {
      console.log(`[bibleTrigger] detector ready (model=${msg.model}) for event ${opts.eventId.slice(0, 8)}`);
    } else if (msg.type === 'error') {
      console.error(`[bibleTrigger] worker error: ${msg.message}`);
    }
  });
  worker.on('error', (err) => console.error('[bibleTrigger] worker thread error:', err));
  worker.on('exit', (code) => {
    if (!stopped && code !== 0) console.error(`[bibleTrigger] worker exited unexpectedly (code ${code})`);
  });

  return {
    feed(pcmBase64: string): void {
      if (stopped) return;
      const buf = Buffer.from(pcmBase64, 'base64');
      if (buf.length === 0) return;
      ring.push(buf);
      ringBytes += buf.length;
      while (ringBytes > RING_MAX_BYTES && ring.length > 1) {
        ringBytes -= ring.shift()!.length;
      }
      worker.postMessage({ type: 'audio', b64: pcmBase64 });
    },
    stop(): void {
      if (stopped) return;
      stopped = true;
      try {
        worker.postMessage({ type: 'stop' });
      } catch {
        // worker may already be gone
      }
      void worker.terminate();
      ring.length = 0;
      ringBytes = 0;
    },
  };
}
