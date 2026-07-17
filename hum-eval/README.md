# hum-eval — Frozen Evaluation Harness for Hum-to-Search

Phase 0 of `HUM_SEARCH_V3_PLAN.md`. **No matcher code gets written or changed
without passing through this harness.** v2 shipped a matcher that scored every
song 87–97% regardless of input; this harness exists so that can never happen
again.

## How it works

1. A **frozen test set** of real hum recordings (WAV + `manifest.json`) lives
   in `testset/`. It is recorded once, then never edited — it is the
   regression suite for every matcher iteration.
2. Every matcher (v2 baseline, every v3 candidate) implements the `Matcher`
   interface and is scored identically on:
   - **MRR, Top-1/3/10** over genuine queries
   - **FAR/FRR** against imposter queries (open-set rejection)
   - **Separation margin**: median(correct-song score) − p95(wrong-song
     scores) — the direct detector of v2's failure mode
   - **Probes**: noise/monotone must be rejected; transposed/stretched hums
     must still match
3. **Ship gates** (from the plan): Top-1 ≥ 80%, Top-3 ≥ 90%, MRR ≥ 0.85,
   FAR ≤ 5% at FRR ≤ 15%, margin > 0.

## Quickstart

```bash
cd hum-eval

# 0. Prove the harness itself works (perfect matcher passes, v2-like fails):
npm run selftest
npm test            # unit tests
npm run type-check

# 1. Record the test set (downloads WAVs + exports manifest.json):
npx serve recorder   # then open http://localhost:3000 in Chrome
# Move downloaded WAVs into testset/queries/ and manifest.json into testset/

# 2. Export v2's fingerprints as the baseline catalog (needs backend/.env):
npm run export:v2-fingerprints

# 3. Run the v2 baseline (needs hum-embedding-service on localhost:8000):
#    cd ../hum-embedding-service && source venv/bin/activate && python main.py
npm run eval -- --manifest testset/manifest.json --matcher v2dtw \
  --catalog testset/v2-fingerprints.json --out reports/v2-baseline.json --verbose
```

Expected outcome of step 3: **v2 fails the gates decisively.** That failing
report is the baseline row every v3 candidate must beat.

## Recording protocol (from the plan, §4 Phase 0)

- **Genuine**: 3–5 hummers (include at least one unmusical person), 15–20
  library songs, 2 takes each, both **chorus and verse** starts, 10–30s,
  desktop and phone. Hum or sing — singing words is allowed and encouraged.
- **Imposter**: ~20 queries of songs NOT in the library (secular pop, "Happy
  Birthday", worship songs not yet imported).
- **Probes**: a few noise recordings (silence/room noise), a monotone hum,
  plus transposed/stretched variants generated offline from genuine takes.
- The recorder disables echoCancellation/noiseSuppression/autoGainControl and
  warns if the browser ignored that (check the warning line before recording
  a batch). Files are 16 kHz mono 16-bit WAV.
- **Freeze**: once ~100 genuine + ~20 imposter queries exist, commit
  `testset/` and do not touch it again. New recordings go into a v2 test set
  extension, never into edits of existing files. (WAVs are ~1 MB each; if repo
  size becomes a concern move them to Git LFS — but they must stay versioned.)

## Layout

```
hum-eval/
  cli/            selftest, evaluate, export-v2-fingerprints
  recorder/       static browser recorder (AudioWorklet raw-PCM capture)
  src/            harness, metrics, manifest, wav, matchers/
    matchers/v2DtwCore.ts   FROZEN copy of the v2 DTW (the baseline; never fix it)
  test/           unit + self-validation tests (node --test)
  testset/        manifest.json + queries/*.wav  ← the frozen test set
  reports/        evaluation reports (JSON), one per matcher run
```

Runs on plain Node ≥ 23 (native TypeScript type-stripping) — no build step,
no dependencies beyond the monorepo root's `@supabase/supabase-js` + `dotenv`
(only used by the export script).
