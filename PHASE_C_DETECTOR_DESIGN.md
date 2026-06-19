# Phase C — Backend always-on Whisper detector (verified design)

**Status:** 🟢 Core detector BUILT & proven in isolation (2026-06-19); runtime de-risked. Handler/frontend wiring + Railway deploy remaining. WIP branch: `feat/bible-detector-phase-c`.
**Depends on:** Phase B (merged) — `bibleReferenceParser.ts` `shouldTrigger()` / `parseForProject()`.
**Goal:** A free, self-hosted, always-on backend detector that transcribes the live mic cheaply, calls `shouldTrigger()`, and on a hit opens the existing ElevenLabs burst window for accurate capture → `parseForProject()` projects. Makes Bible mode truly trigger-only (idle except the 2–3 references/hour).

## Build progress (2026-06-19)

**Done — core detector, proven in isolation against real sermon clips:**
- `backend/src/services/bibleTriggerWorker.ts` — worker_thread running sherpa-onnx Silero VAD + Whisper ONLY (imports no app modules). Posts each finalized segment's text. Loaded CJS via `execArgv: ['--require', 'tsx/cjs']` in dev / compiled `.js` in prod (extension-detected by `__filename`).
- `backend/src/services/bibleTriggerService.ts` — main-thread façade: 30s catch-up ring buffer, runs `shouldTrigger()` on segment text, per-trigger cooldown, fires `onTrigger(catchUpBase64)`.
- `backend/scripts/test-bible-detector.ts` — smoke test: streams clips → VAD → Whisper → trigger + catch-up. Verified (PCM→VAD→ASR→shouldTrigger→catch-up all flow).
- **Bug fix** in `bibleReferenceParser.ts`: `shouldTrigger` no longer fires on a FUZZY book match with no number (e.g. "…bible tonight" → Isaiah 0.74). An exact book name triggers alone; a fuzzy match requires a number. 51 tests pass; lint + type-check green.
- **Recall note:** base.en catches "Acts chapter 9" / "John 3:16"; missed the hard clips' "Galatians 2:20" (→"Galician") and a fast "turn the Acts chapter 9" (→"ax/act"). Levers: `small.en` (env), the soundboard feed, and push-to-talk (Phase D). Architecture unchanged.

**Remaining:** handler wiring (fork `:2152`, `openSmartListenWindowFromDetector` `:2291`, SessionState fields, teardown `:2975`); frontend continuous-send; Railway volume + first-boot model download; `.env.example`; `small.en` eval on real soundboard audio.

---

## Runtime decision: `sherpa-onnx-node` (pinned `1.13.3`)

Chosen over smart-whisper / faster-whisper / transformers.js because it is the only option that: needs **no Python** (pure native N-API addon — nixpacks stays Node-only); bundles **both Silero VAD + Whisper** in one dep; is **actively maintained** (1.13.3 published 2026-06-15); takes 16k mono Float32 PCM directly with a resident model.

**Verified end-to-end (2026-06-19) on real sermon clips:**
- Prebuilts publish for `darwin-arm64` (dev) AND `linux-x64` (Railway) at 1.13.3; `npm install` pulled the prebuilt in ~1s, no compile.
- Native addon loads; exports `OfflineRecognizer`, `Vad`, etc.
- Whisper tiny.en: model load 134ms; **RTF ≈ 0.03** (20s audio → ~550ms inference); references transcribed correctly.
- Silero VAD: clean utterance segmentation with `new Vad({ sileroVad: {...} }, bufferSec)` → `acceptWaveform(512-sample frames)` → `front()/pop()` yielding `{start, samples}`.
- Verified API shape: `new OfflineRecognizer({ modelConfig: { whisper: { encoder, decoder }, tokens, numThreads, provider:'cpu' } })`; `stream.acceptWaveform({sampleRate:16000, samples:Float32Array})` → `recognizer.decode(stream)` → `recognizer.getResult(stream).text`.

**Runner-up (only if native addon proves flaky on Railway or hard crash-isolation is wanted):** faster-whisper as a SEPARATE Railway Python service (own Dockerfile, not in the nixpacks image), Node forwards PCM over a local hop.

---

## Architecture

Detector runs ONLY while `bibleMode + smartListenEnabled` are on, kill switch off, AND the ElevenLabs window is CLOSED. End-to-end:
1. Frontend streams PCM 16k mono **continuously** (REQUIRED change — today it buffers locally and only sends on window-open).
2. `handler.ts:2152` — where the closed-window branch does `return; // Drop audio` — instead **fork the base64 PCM to a per-session detector** before returning.
3. Detector (`bibleTriggerService.ts`): decode base64→Int16→Float32; Silero VAD segments utterances; resident Whisper transcribes each finalized segment in a **worker_thread** (event loop never blocks); maintains a ~30s catch-up ring buffer + 400ms pre-roll.
4. Segment text → n-gram suffix de-dup → `shouldTrigger(text)`.
5. On a true hit (multi-word segment, not in per-reference cooldown): fire `onTrigger(catchUpBase64)` → run the **same path as `handleSttWindowRequest`**: set `sttWindowActiveUntil`, lazy-init ElevenLabs stream, flush catch-up PCM.
6. Existing pipeline: ElevenLabs transcribes accurately → `parseForProject()` → projects. Detector goes idle (window now open).

**Safety:** detector text NEVER goes to the client; it only *opens a window*. `parseForProject()` on the accurate burst is the only thing that projects, so a music/lyric false positive costs ≤30s of a paid window, never a wrong slide.

**VAD/chunk params:** threshold 0.35, minSilence 0.5s, minSpeech 0.25s, windowSize 512 (~32ms), maxSpeech 5s; 400ms pre-roll; Whisper base.en, beam 1, condition_on_previous_text=false, lang=en. Latency ≈ 1–4s (fine; burst does accurate capture).

---

## Build checklist

1. `npm install --save-exact sherpa-onnx-node@1.13.3 -w @parleap/backend` (verify prebuilt on a clean linux container too).
2. Model on a **Railway Volume**, downloaded on first boot (idempotent start step) — NOT baked into the image. base.en ~140MB / small ~466MB.
3. NEW `backend/src/services/bibleTriggerService.ts`: `createBibleTriggerDetector({sessionId, eventId, onTrigger}) → { feed(base64), stop() }`. Resident recognizer + VAD; worker_thread inference; 30s ring buffer + 400ms pre-roll; n-gram de-dup; `shouldTrigger()` integration; call `initBibleReferenceParser()` at startup.
4. `handler.ts` edits: constants near `:180` (`BIBLE_DETECTOR_ENABLED`, `BIBLE_DETECTOR_MODEL`); SessionState fields near `:384` (`bibleTriggerDetector`, `lastDetectorTriggerAt`); replace drop-`return` at `:2152` with detector lazy-init + `feed(data)`; new `openSmartListenWindowFromDetector()` near `:2291` (mirrors `handleSttWindowRequest` minus the request guards, with cooldown); `detector.stop()` in `handleClose` `:2975`.
5. `.env.example`: `BIBLE_DETECTOR_ENABLED=true`, `BIBLE_DETECTOR_MODEL=base`, `BIBLE_DETECTOR_WARMUP_ON_STARTUP=false`. `BIBLE_SMART_LISTEN_ENABLED=false` still master-kills it.
6. **Frontend:** remove the window-closed send-gate so PCM streams continuously in bibleMode+smartListen; keep `STT_WINDOW_REQUEST` as a manual fallback button; optional "Listening (auto)" indicator.
7. `nixpacks.toml`: ffmpeg already present; only add build-essential+cmake if the prebuilt is missing for the target (verify first). Add Railway Volume + model env path.
8. Test: speak a reference with window closed → VAD segment → `shouldTrigger` → "[STT] window opened by backend detector" → ElevenLabs → `parseForProject` projects. False-positive (worship lyric) opens+closes a window, no projection. Cooldown suppresses re-fire within 30s.

---

## Decisions for owner (defaults chosen; all reversible)
1. **Model:** start `base.en` (~1GB RAM/session, more concurrency); bump to `small` if recall insufficient. **Default: base.**
2. **False-positive cost:** ~30s of paid ElevenLabs per false trigger, bounded by cooldown + recall/precision split. Tune VAD 0.35→0.4 if noisy. **Default: accept, threshold 0.35.**
3. **Crash isolation:** in-process worker_thread (simplest) vs faster-whisper separate service (hard isolation, +2-3 days ops). **Default: in-process worker_thread.**
4. **Concurrency target:** how many simultaneous Bible-mode services? Sets Railway RAM (RAM-bound; base ≈2× sessions/replica vs small). **Default: size for a few; add shared-recognizer-per-event later.**
5. **Continuous-send privacy:** client streams mic to backend continuously in Bible mode (processed offline, never persisted/returned). **Default: OK.**
6. **Warmup-on-startup:** pre-load model at boot (faster first trigger, steady RAM) vs lazy. **Default: warmup ON in prod.**

## Risks
Native-addon ABI on Railway (mitigate: pin 1.13.3, verify prebuilt in clean linux container, keep sidecar runner-up ready) · in-process crash (worker_thread isolation + try/catch) · music false-opens (bounded by design; tune threshold) · **frontend continuous-send is load-bearing** (if it doesn't ship, detector gets no audio and silently never fires — add a backend "no audio while gate active" log) · RAM-bound concurrency · cold-start (enable warmup).

**Effort:** ~3–5 focused days (1.5 service · 0.5 handler · 0.5 frontend · 0.5–1 deploy · 1 test/tune).
