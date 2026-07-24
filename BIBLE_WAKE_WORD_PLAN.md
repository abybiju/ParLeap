# Smart Bible Wake-Word — Implementation Plan

**Status:** 📐 Planned (ready to implement)
**Date:** 2026-07-24
**Depends on:** Phase B (merged — `bibleReferenceParser.ts`), Phase C core (merged — `bibleTriggerWorker.ts` / `bibleTriggerService.ts`, built but unwired).
**Builds on:** `SMART_BIBLE_LISTEN_V2_PLAN.md`, `PHASE_C_DETECTOR_DESIGN.md`.

---

## 0. Goal & the load-bearing invariant

Replace "always transcribe everything" with a **wake-word front-gate** so the expensive accurate STT (ElevenLabs) runs only for the 2–3 verse moments per service.

**Invariant — only Smart Bible mode is wake-gated:**

| Mode | Listening behavior | Changed? |
|---|---|---|
| **Song / lyric mode** (`bibleMode = false`) | Continuous ElevenLabs STT — the lyric-following moat | ❌ untouched |
| **Bible mode + smart listen** (`bibleMode = true`) | Cheap always-on **wake spotter**; ElevenLabs opens only on a scripture cue | ✅ this plan |

This invariant is already enforced by `shouldUseSmartListenGate(session)` (`handler.ts:417`), which requires **both** `smartListenEnabled === true` **and** `bibleMode === true`. We are turning that gate on and giving it a reliable trigger.

---

## 1. Current state (verified against the code)

1. **STT is continuous for the whole active session, regardless of Bible mode.** `effectiveSmartListen = false` (`OperatorHUD.tsx:99`); the comment says continuous STT is used for both songs and Bible. With that false, the frontend never buffers and `shouldUseSmartListenGate` returns false → ElevenLabs streams the entire service.
2. **The backend wake gate already exists but is dormant.** When `shouldUseSmartListenGate` is true and no window is open, `handleAudioData` does `return; // Drop audio` (`handler.ts:2152`, and the Google path at `:2228`). A window is opened by `handleSttWindowRequest` (`:2291`) → sets `sttWindowActiveUntil`, lazy-inits ElevenLabs (`initElevenLabsStream` `:598`), flushes catch-up.
3. **The wake engine is dormant *and* fragile.** The only wake path is `useBibleWakeWord` (browser **Web Speech API**) + `shouldWakeForBibleTranscript()` regex → `requestSttWindow()`. It's disabled (`enabled: … && effectiveSmartListen`) and, per the v2 plan, is the weak link (dies on tab blur / long sessions / noise).
4. **A robust engine is already installed and unused.** `sherpa-onnx-node@1.13.3` ships `KeywordSpotter` (`node_modules/sherpa-onnx-node/keyword-spotter.js`) — streaming, custom `keywordsFile`, near-zero CPU. No app code references it. The Phase C worker already runs this same addon's VAD + Whisper in a `worker_thread`.

---

## 2. Target architecture

```
 SONG MODE (unchanged):  mic → PCM → backend → ElevenLabs (continuous) → lyric matcher

 BIBLE MODE + SMART LISTEN (new):
   mic → PCM 16k mono (streamed CONTINUOUSLY to backend)
        │
        ▼  backend, per-session detector worker (sherpa-onnx, worker_thread)
   ┌───────────────────────────────────────────────────────────────┐
   │  KeywordSpotter  ── cue phrase hit ("turn to…") ──┐            │
   │  (always-on, cheap, custom keywords.txt)          │            │
   │                                                   ├─► onTrigger │
   │  [optional] VAD+Whisper shouldTrigger()  ─────────┘  (+catch-up)│
   │  (un-cued safety net: "John 3:16 says…")                       │
   └───────────────────────────────────────────────────────────────┘
        │  onTrigger(catchUpBase64)
        ▼
   openSmartListenWindowFromDetector()  → set sttWindowActiveUntil,
        init ElevenLabs, flush 30s catch-up PCM  (mirrors handleSttWindowRequest)
        │
        ▼  ElevenLabs accurate 30s burst → parseForProject() (strict) → project
```

**Trigger liberally, project conservatively** (unchanged): a wake only opens an *invisible* ElevenLabs window; `parseForProject()` still gates the screen. A false wake costs ~30s of a paid window, never a wrong slide.

**Why backend KWS (not in-browser):** `sherpa-onnx-node` is a Node native addon and is already installed + wired into the Phase C worker. An in-browser spotter would need the separate `sherpa-onnx` WASM build (heavier, new dep). Backend KWS reuses what exists; the only cost is streaming Bible-mode PCM to your own backend (processed offline, not persisted — the v2 "continuous-send OK" decision).

---

## 3. Components — build / change list

### 3.1 Models (new asset + existing)
- **KWS model** (new): a sherpa-onnx English streaming keyword-spotter, e.g. `sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01` (~small; encoder/decoder/joiner `.onnx` + `tokens.txt` + `bpe.model`).
- **Whisper model** (existing, only if keeping the un-cued net): `base.en` int8 as today.
- **Hosting:** Railway Volume, downloaded on first boot (idempotent start step), NOT baked into the image — same approach the Phase C doc already specifies. The `models/` dir does not exist in the repo yet.

### 3.2 `keywords.txt` (new — the wake vocabulary)
Custom cue phrases the pastor already says. **These are configured, not trained**: each line is the phrase tokenized into the model's BPE pieces (generate with sherpa's `text2token` tool against the model's `bpe.model`), optionally with a per-phrase boost `:score` and `#threshold`.

Starter cue set (raw phrases — tokenize before use):
```
turn to
turn with me to
open your bible to
open your bibles to
let's turn to
the book of
the gospel of
found in
reading from
it is written
according to
scripture reading
```
Bias toward recall (false wakes are cheap). Prefer distinctive multi-word phrases; avoid bare "chapter"/"verse"/"go to" (too common). Tune `#threshold` per phrase after the offline bench.

### 3.3 Backend worker — `bibleTriggerWorker.ts` (extend)
Add a `KeywordSpotter` **alongside** the existing `Vad` + `OfflineRecognizer`, fed from the same `feedPcm()`:
- Init: `new sherpa.KeywordSpotter({ modelConfig: { transducer: { encoder, decoder, joiner }, tokens }, keywordsFile, keywordsThreshold, keywordsScore })`.
- One persistent `OnlineStream` from `kws.createStream()`; in `feedPcm`, `stream.acceptWaveform({ sampleRate:16000, samples })`, then `while (kws.isReady(stream)) kws.decode(stream)`; read `kws.getResult(stream)`; if `result.keyword` is non-empty → `post({ type:'keyword', keyword: result.keyword })` and `kws.reset(stream)`.
- Keep VAD+Whisper `post({type:'segment'})` as-is (the un-cued net). Gate its init behind `BIBLE_DETECTOR_WHISPER_NET` so KWS can run alone.

### 3.4 Backend façade — `bibleTriggerService.ts` (extend)
- Handle the new `'keyword'` message as an **immediate trigger**: reuse the existing cooldown (`MIN_TRIGGER_GAP_MS`) + 30s catch-up ring, then `opts.onTrigger(catchUp)`. (Same seam the `'segment'`→`shouldTrigger` path already uses at `:64-87`.)
- No API change to `createBibleTriggerDetector` — both trigger sources converge on `onTrigger`.

### 3.5 Backend handler — `handler.ts` (wire the detector in)
- **SessionState:** add `bibleTriggerDetector?: BibleTriggerDetector` and `lastDetectorTriggerAt?: number` (near the existing smart-listen fields `:381-384`).
- **Fork instead of drop:** at the gate-closed branches (`:2152` streaming path, `:2228` Google path), before `return`, lazy-init the per-session detector and `session.bibleTriggerDetector.feed(data)`. Audio is fed to KWS but still **not** forwarded to ElevenLabs.
- **`openSmartListenWindowFromDetector(session, ws, catchUpBase64)` (new, near `:2291`):** mirror `handleSttWindowRequest` minus the client-request guards — set `sttWindowActiveUntil = now + BIBLE_SMART_LISTEN_WINDOW_MS`, `initElevenLabsStream`, flush catch-up. Enforce `lastDetectorTriggerAt` cooldown. Pass this as `onTrigger` when creating the detector.
- **Teardown:** `session.bibleTriggerDetector?.stop()` when Bible mode turns off (`:966`, `previousBibleMode && !session.bibleMode`) and in `handleClose`.

### 3.6 Frontend — `OperatorHUD.tsx` / `useAudioCapture.ts`
- **Turn the gate on for Bible mode only:** send `smartListenEnabled = true` to the backend when `bibleMode` is on (drives `shouldUseSmartListenGate`). Replace the hardcoded `effectiveSmartListen = false` (`:99`).
- **Stream PCM continuously in Bible mode** so the backend KWS can hear it: do **not** use the browser's buffer-until-window path (`useAudioCapture.ts:335`) — the catch-up ring now lives on the backend. Simplest: keep the audio hook's local `smartListenEnabled` **off** (always send PCM) while telling the *backend* smart-listen is on. i.e. decouple "backend gate on" from "browser withholds audio."
- **Retire** `useBibleWakeWord` (Web Speech) to an optional fallback (or delete). Keep `STT_WINDOW_REQUEST` / a **"Capture verse now"** button as the manual push-to-talk backstop.

### 3.7 Env vars
```
BIBLE_SMART_LISTEN_ENABLED=true         # existing master kill switch (false forces gate off)
BIBLE_SMART_LISTEN_WINDOW_MS=30000      # existing burst length
BIBLE_KWS_MODEL=kws-zipformer-gigaspeech # new
BIBLE_KWS_MODELS_DIR=/data/models        # new (Railway volume)
BIBLE_KWS_KEYWORDS_FILE=/data/models/keywords.txt   # new
BIBLE_KWS_THRESHOLD=0.25                 # new (per-phrase overridable in keywords.txt)
BIBLE_KWS_SCORE=1.5                      # new (global boost)
BIBLE_DETECTOR_WHISPER_NET=true          # new: keep VAD+Whisper un-cued safety net
BIBLE_DETECTOR_MODEL=base.en             # existing (only used when WHISPER_NET=true)
```

---

## 4. The one real decision: KWS-only vs KWS + Whisper net

A pure cue-wake misses references with **no preamble** ("John 3:16 says…"). Two options:

- **A — KWS + Whisper net (recommended; reliability > cost).** KWS gives the fast/cheap cue trigger; VAD+Whisper `shouldTrigger()` catches un-cued refs. Both feed the same window. Max recall. Cost: Whisper still runs always-on (real CPU/RAM per session) — so the *always-on compute* isn't reduced, only the *paid ElevenLabs* is gated.
- **B — KWS-only (max cost/concurrency win).** Retire always-on Whisper; near-zero-CPU KWS is the only always-on model. Biggest savings, but only catches cue-introduced refs — lean on a rich keyword list + the push-to-talk backstop.

**Recommendation:** ship **A** (set `BIBLE_DETECTOR_WHISPER_NET=true`), measure in shadow mode what fraction of real references were cue-introduced; if it's high, flip to **B** to drop the Whisper CPU. The env toggle makes this a one-line change, no redeploy of logic.

---

## 5. Staged rollout (mandatory order)

1. **Offline bench** — run KWS (+ parser) over the saved sermon clips (`/tmp/parleap_sermon_test/`, the Bridge PA "Acts 9" set). Measure wake **recall** (every real reference triggers) and false-wake rate. Tune `keywords.txt` thresholds. *Gate before any live use.*
2. **Shadow mode** — run live, log would-be wakes + would-be projections without showing them; compare to the operator's manual actions for a few services. Also logs cued-vs-uncued split for the A→B decision.
3. **Live with backstop** — enable projection with the "Capture verse now" button always available.
4. **Full** — default on for Bible mode; keep the manual button.

---

## 6. Effort (rough)
- KWS in worker + service (§3.3–3.4): ~1 day.
- handler wiring + window-from-detector + teardown (§3.5): ~0.5–1 day (reuses Phase C seams).
- Frontend gate-on + continuous-send + retire Web Speech (§3.6): ~0.5 day.
- Models on Railway volume + first-boot download + keywords.txt (§3.1–3.2): ~0.5 day.
- Offline bench + threshold tuning (§5.1): ~1 day.
- **Total ≈ 3.5–4 focused days.**

## 7. Open decisions
1. **Whisper net on/off at launch** — recommend on (A) for reliability. §4.
2. **KWS model choice** — gigaspeech-3.3M (tiny, fast) vs a larger KWS model if recall on cue phrases is weak. Start small.
3. **Keyword vocabulary** — confirm the cue list against how *this* congregation's preacher actually introduces verses (record one service).
4. **Continuous Bible-mode PCM upload** — confirmed acceptable? (audio to own backend, offline, not persisted). Default: yes.
5. **Manual backstop UX** — button vs hotkey for "Capture verse now."

## 8. Wake test cases (offline bench)
| Spoken cue | Expect wake? |
|---|---|
| "Let's turn to Acts chapter 9" | ✅ (cue + downstream captures ref) |
| "Open your Bibles to John 3:16" | ✅ |
| "John three sixteen says…" (no cue) | ✅ only if Whisper net on (Option A) |
| "Turn to your neighbor and say…" | ⚠️ wake (cheap) → parseForProject finds no ref → no projection |
| worship lyrics, no cue | ❌ no wake |
