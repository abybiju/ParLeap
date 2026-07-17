# Hum-to-Search v3 — Research & Plan (July 2026)

**Status:** PHASE 0 IN PROGRESS — research complete 2026-07-16; eval harness + recorder + v2 baseline adapter built and verified same day (`hum-eval/`, branch `feat/hum-v3-phase0-eval-harness`). **Next action: record the frozen test set** (~100 genuine hums from 3–5 hummers, ~20 imposters, noise probes) via `npx serve hum-eval/recorder`, then run the v2 baseline row. See `hum-eval/README.md` for the protocol.
**Predecessor:** v2 (CREPE + DTW) paused 2026-04-04. Post-mortem: `HUM_SEARCH_STATUS.md` and memory `project_hum_search_v2.md`.
**Goal:** operator hums/sings 10–30s into the browser mic → app reliably surfaces the right song from the church library (~35 songs now, several hundred later). Reliability > cost. This time the feature must be *provably* reliable before it ships — "unbreakable" means gated on frozen measurements, not vibes.

---

## 1. Why v2 failed (and why v3 is not a retry)

v2 died from three compounding mistakes, each specifically warned against in the MIR literature:

1. **Junk references.** Melody contours were extracted from full-mix YouTube audio (pYIN + HPSS picks up guitar/bass/keys, not the vocal line).
2. **Wrong matcher.** Unconstrained subsequence DTW on first-order pitch intervals. The local-warp freedom of unconstrained DTW lets a short query align to *anything* — all 35 songs scored 87–97% regardless of input. Intervals (vs. absolute contours + transposition search) amplified extraction noise.
3. **No evaluation harness.** Nothing measured score *separation* between the true match and impostors, so the failure shipped and was discovered by hand.

Classic MIREX QBSH systems (2006–2021) achieved **MRR 0.88–0.93 with ~8s hums against 2,048-song catalogs of melodically-similar folk tunes** — the same stepwise/narrow-range similarity profile as worship music, at 4–40× our catalog size. QbH at our scale is a solved problem *when done the way the literature says*: clean monophonic references, absolute-pitch contours with explicit transposition search, linear scaling (global tempo stretch, no local warping) as the primary matcher, tightly banded DTW only for re-ranking, and per-query score normalization.

## 2. Research findings (2026-07-16)

Three parallel research tracks. Full sources at the bottom.

### Track A — Commercial APIs
- **ACRCloud is the only self-serve hum-recognition API in 2026.** Dedicated humming/cover engine, 14-day full trial, ~$0.005/request, `POST /v1/identify` multipart, clips ≤15s, returns ranked `metadata.humming[]` candidates with scores.
- **Critical limitation:** humming matches ONLY against ACRCloud's global melody DB (~1M songs — much smaller than their 150M fingerprint DB). **No self-serve custom bucket for humming.** Coverage of mainstream CCM is plausible but unverified; hymn arrangements, local/original songs will *never* match.
- Independent yardstick: the CHAD paper measured ACRCloud humming at **0.986–0.990 Top-10 hit rate** — the reliability ceiling money can buy.
- SoundHound (midomi tech) still does humming+singing but is enterprise-sales-only (eval via ddenbo@soundhound.com). AudD, ShazamKit, Google, Gracenote, Pex: confirmed dead ends for humming.
- Nobody sells custom-catalog humming self-serve, so the commercial architecture is **identify-then-map**: hum → ACRCloud global candidates → intersect top-N with the local library on normalized title (ignore artist; strip parenthetical subtitles).

### Track B — Self-hosted
- **No public pretrained QbH checkpoint exists anywhere** (mid-2026). Every strong system (Google, ByteDance, ACRCloud) is proprietary; open papers release recipes/datasets, not weights.
- **Cover-song-ID checkpoints (CoverHunter, ByteCover) are a dead end for hums** — no positive evidence, and ByteDance's own QbH paper retrained with source-separated data rather than reusing their CSI model. Worth at most a 1-day falsification experiment.
- **The reference-side problem is now trivial:** Demucs via MLX runs ~73× realtime on Apple Silicon (7-min song ≈ 12s). Separate vocals for the whole catalog offline on the dev Mac, extract f0 with **RMVPE** (robust to separation bleed; MLX port exists), ship only tiny contour blobs to production. Kills the Railway OOM problem entirely. Cloud fallback: Replicate demucs ≈ $0.005–0.022/song.
- **Recommended matcher (classic pipeline, ~1–2 weeks):** frame-level semitone contours + voicing mask on both sides → transposition search (median-shift ± a few semitones) → **Linear Scaling** (stretch query 0.5–2.0× in ~30 steps, slide over reference, min distance) → banded-DTW re-rank on top candidates → per-query score normalization + open-set rejection threshold. Pure CPU in production.
- **Escalation path if the classic matcher plateaus:** CHAD recipe (ISMIR 2023) — ResNet18 on f0 windows, NT-Xent contrastive loss, trained on the public CHAD dataset (18h hums + 308h covers); benchmarks 0.87–0.97 Top-10 HR, 0.71 at a 90k catalog. Trains on one consumer GPU; 2–6 weeks solo effort. Only pull this lever with measurements in hand.
- Match frame-level contours, not transcribed notes — hum-to-note transcription is still genuinely weak in 2026 (HumTrans baselines all judged poor).

### Track C — Data & validation
- **No church presentation product has hum search** (ProPresenter, EasyWorship, Proclaim, OpenLP, FreeShow, Planning Center checked). Genuine differentiator.
- Symbolic melody data exists if we ever want it: SongSelect lead-sheet PDFs → Audiveris OMR (~80–90%+ on clean digital lead sheets; ToS gray zone — manual downloads within the church's subscription only), Hymnary.org / Open Hymnal have free MusicXML/MIDI/ABC for hymns. **Not required for v3** (Track B extracts references from audio), but hymn MIDIs are a free accuracy upgrade and the Open Hymnal MIDI dump doubles as distractor padding.
- **Evaluation protocol (the heart of "unbreakable"), grounded in MIREX practice:** frozen query set recorded before any matcher code; metrics MRR + Top-1/3/10; imposter queries for open-set FAR/FRR; distractor padding (Essen collection / Open Hymnal MIDIs) to 500–2,000 catalog entries; score-separation margin assertion run like a regression test. MIR-QBSH (4,431 queries / 48 MIDIs, free) validates the matcher implementation itself before pointing it at worship data.
- **Browser capture:** disable echoCancellation/noiseSuppression/autoGainControl (verify via `track.getSettings()` — Chrome doesn't always honor constraints), capture raw Float32 PCM via **AudioWorklet** instead of MediaRecorder/Opus, mono, downsample to 16kHz. iOS Safari is the risk platform (processing constraints historically ignored; AudioContext sample-rate glitches) — test early, built-in mic only.

## 3. v3 architecture decision

**Hybrid, local-first:**

```
Browser (AudioWorklet, raw PCM 16k mono, processing disabled)
   │
   ▼
Backend /api/hum-search  ──► Local contour matcher (all library songs)
   │                              contours precomputed offline:
   │                              Demucs-MLX → RMVPE → semitone contour
   │                              (hymns: MIDI-derived contours where available)
   │
   └──► ACRCloud humming (parallel query, if enabled)
              │
              ▼
        top-N candidates ∩ library (normalized title match)

Fusion: agreement boosts confidence; either source alone must clear its
calibrated threshold; below threshold → honest "no match" (never a guess).
```

Why hybrid: the two paths fail independently. ACRCloud is near-ceiling accurate but blind to hymns/originals and dependent on their catalog; the local matcher covers exactly what the church owns but is ours to get right. Agreement between independent systems is what makes the result trustworthy; disagreement below threshold surfaces as "no match" instead of a wrong song. Local-first because it works for every song, costs nothing per query, and has no external dependency — ACRCloud is the accuracy booster and cross-check, not the foundation.

## 4. Phases and gates

**Phase 0 — Frozen test set + eval harness (build FIRST, ~2–3 days)**
- Record ~100 genuine queries: 3–5 hummers (include at least one unmusical person), 15–20 songs × 2 takes, verse AND chorus starts, through the real browser capture path on desktop + phone.
- Record ~20 imposter queries (songs NOT in the library: secular pop, "Happy Birthday", unimported worship songs) + sanity probes (white noise, monotone hum, same hum transposed ±3 semitones and time-stretched ±20%).
- Harness computes MRR, Top-1/3/10, FAR/FRR at a threshold, and the **separation margin**: median(top-1 score) − 95th-percentile(non-match scores). Distractor padding to 500+ with Open Hymnal / Essen MIDIs.
- **Freeze the set.** Run v2's DTW matcher as the baseline row (it should fail spectacularly — that's the point; if the harness doesn't flag v2, the harness is wrong).
- Gate to proceed: harness demonstrably discriminates (v2 fails it, a human-picked known-good ranking passes it).

**Phase 1 — ACRCloud coverage spike (~1 afternoon, overlaps Phase 0)**
- Free-trial account, wire a script (not app code) that fires the frozen queries at `/v1/identify` with the humming engine, 10–15s clips.
- Measure: library coverage (which of the 35 songs their melody DB knows), Top-1 and Top-5∩library hit rates, latency from Railway region, score distribution for threshold calibration, imposter behavior.
- Also: one email to ACRCloud sales re: custom humming bucket (Business Customization) — a "yes" changes the calculus; don't block on the reply.

**Phase 2 — Local contour pipeline (~1–2 weeks)**
- Ingestion (dev-Mac CLI, not Railway): YouTube/uploaded audio → Demucs-MLX vocal stem → RMVPE f0 → semitone contour + voicing mask, 2–4 representative segments per song (verse/chorus), stored in Supabase (few KB/song). Hymns: derive contours from Hymnary/Open Hymnal MIDI directly where available.
- Matcher (Node or the existing Python service): transposition search + Linear Scaling primary + Sakoe-Chiba-banded DTW re-rank + per-query score normalization + open-set threshold. Chunk 30s queries into 8–12s windows and vote (guards against singer key drift).
- Validate the matcher implementation on MIR-QBSH first (should reproduce ≈0.9 Top-10 at 48 songs + 2k distractors) — this proves the code before worship-melody homogeneity is in play.
- Gate: on the frozen worship set — **Top-1 ≥ 80%, Top-3 ≥ 90%, MRR ≥ 0.85, FAR ≤ 5% at FRR ≤ 15%, positive separation margin — and all of it still holding with 500+ distractors in the catalog.**

**Phase 3 — Decision + fusion**
- Ship-shape decision from measured numbers: local-only, ACRCloud-assisted hybrid, or (if local stalls AND ACRCloud coverage is strong) ACRCloud-primary with local fallback for uncovered songs.
- Escalation trigger: local matcher Top-3 < 90% after tuning → CHAD-style embedding model becomes Phase 5 (do NOT tune DTW thresholds for weeks — that was v2's death spiral; the post-mortem's five threshold-tweak commits are the cautionary tale).

**Phase 4 — Product integration + v2 teardown**
- New capture path: AudioWorklet PCM, processing constraints off + `getSettings()` telemetry, iOS Safari tested early.
- Replace the 7 `/api/hum-search/*` routes with one simple endpoint (+ keep the continuous-matching UX from v2 — it was good). Tear out `dtwService.ts`, `autoFingerprintService.ts`, interval-based fingerprints, migrations for contour storage.
- UX: show top-3 candidates with confidence, honest "no match — try singing the chorus with words" state (singing with lyrics outperforms pure humming on every system tested).
- Regression harness runs against every matcher change from here on.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Worship melodic homogeneity defeats even correct classic matching | Measurable in week 1 via Phase 0 set — before any matcher code. Longer queries (10–30s spans multiple phrases; rhythm+contour jointly discriminate). Escalation: CHAD embeddings. |
| ACRCloud melody DB doesn't cover the library | Phase 1 measures it in an afternoon. Local path is primary regardless. |
| iOS Safari capture quality | Test in Phase 0 with real devices; built-in mic; explicit AudioContext sample rate. |
| Demucs/RMVPE ingestion friction (per-song, offline) | ~12s/song on Apple Silicon; Replicate fallback ≈ $0.01/song; ingestion is a CLI batch, not a serving dependency. |
| Solo-dev scope creep into ML research | Hard gates + escalation triggers; embeddings only after classic pipeline measurably plateaus. |

## 6. Kept from v2
- Continuous-matching frontend UX (progress bar, auto-stop), noise guards concept (now principled via open-set threshold), the Python FastAPI service shell (repurposed for RMVPE extraction), the ingestion→Supabase plumbing shape.

## 7. Open questions (hands-on only)
1. ACRCloud coverage/latency/threshold on OUR songs (Phase 1).
2. Whether the classic matcher clears the gates on worship data (Phase 2) — the one genuinely open research question.
3. ACRCloud custom-bucket sales answer; SoundHound eval terms (one email each, non-blocking).
4. Real iOS Safari capture behavior in 2026.
5. (Deferred) SongSelect ToS read for OMR-derived melody indexing — only matters if we later want symbolic references for CCM.

## 8. Key sources
- MIREX QBSH results: music-ir.org/mirex/wiki/2006:QBSH (MRR 0.88–0.93, 2k-song DBs)
- CHAD (ISMIR 2023): arxiv.org/abs/2312.01092, github.com/amanteur/CHAD — recipe + the ACRCloud 0.986–0.990 yardstick
- ACRCloud humming docs: docs.acrcloud.com (identification-api, metadata/humming; custom buckets exclude humming — verified 2026-07-16)
- RMVPE: github.com/Dream-High/RMVPE (+ mlx port: huggingface.co/lexandstuff/mlx-rmvpe); Demucs-MLX: github.com/ssmall256/demucs-mlx
- Eval corpora: MIR-QBSH (Jang, NTHU), MTG-QBH (zenodo 1290712), Essen collection distractors; Open Hymnal MIDI dump (openhymnal.org)
- Browser capture: addpipe getUserMedia constraints writeup; WebKit bug 179411 (iOS echoCancellation ignored)
