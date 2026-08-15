# Deploying Smart Bible Wake Word (PR #3) to Railway

> **STATUS 2026-08-15: DEPLOYED AND LIVE.** Volume + env in place, models on the
> volume, `[models] ready` in boot logs, live "open Bible" fire confirmed. Two
> runbook corrections learned during the deploy: (1) the Railway dashboard
> **Custom Start Command overrides** nixpacks.toml/railway.toml — the download is
> wired there as `bash backend/scripts/download-models.sh; npm run start
> --workspace=@parleap/backend` (parser rejects `(…)` subshells; `;` keeps it
> non-fatal); (2) the runtime image needed **bzip2** in `nixpacks.toml` aptPkgs
> for the .tar.bz2 model archives. Voice mode switching (open/close bible)
> shipped after in PR #4. See SESSION_2026-08-15_LIVE_E2E_AND_BIBLE_WAKE_DEPLOY.md.

Turns Bible mode from "continuous paid ElevenLabs STT" into "free local wake detection,
paid STT only in short windows after a scripture cue." Song/lyric mode is untouched
(continuous STT is the lyric-following engine).

Wake triggers after deploy: deliberate commands ("**open Bible**", "open the Bible"),
natural cues ("turn with me to…", "open your Bibles to…", "it is written…"), and the
VAD+Whisper safety net for references spoken with no cue at all ("John 3:16 says…").

## Pre-flight (already true — verify, don't redo)

- [x] PR #3 (`feat/bible-wake-word`) is green and mergeable.
- [x] `sherpa-onnx-node@1.13.3` is already a backend dependency **on main** (Phase C worker),
      so the native addon is not new to production.
- [x] `backend/scripts/download-models.sh` is idempotent (re-runs skip present files) and the
      start commands (root `nixpacks.toml` + `backend/railway.toml`) tolerate its failure —
      a failed download degrades the detector, it does not block boot.
- [x] Detector worker errors are logged (`[bibleTrigger] worker error`), never fatal:
      song mode cannot be taken down by a bible-detector problem.
- [x] Frontend needs **no changes**: `effectiveSmartListen=false` in `OperatorHUD.tsx` is by
      design (browser always streams PCM; the gate lives in the backend, toggled per-session
      by `backendSmartListen = master && bibleMode`).

## Deploy order (do the dashboard steps BEFORE merging)

### 1. Railway dashboard → `@parleap/backend` service

1. **Attach a Volume**, mount path **`/data`**, size **1 GB**.
   (Downloads: Whisper base.en int8 ~80 MB + KWS ~20 MB + silero VAD ~2 MB.)
2. **Add environment variables:**

   | Variable | Value | Why |
   |---|---|---|
   | `BIBLE_SMART_LISTEN_ENABLED` | `true` | Explicit master switch (unset = on; `false` is the kill switch). |
   | `BIBLE_DETECTOR_MODELS_DIR` | `/data/models` | Where models live (the volume). Matches the default; set for clarity. |
   | `BIBLE_DETECTOR_WHISPER_NET` | `true` | Keep the un-cued safety net — the real engine per the sermon bench. |

   Optional tuning (defaults are fine to start): `BIBLE_DETECTOR_MODEL=base.en`,
   `BIBLE_SMART_LISTEN_WINDOW_MS=30000`, `BIBLE_DETECTOR_COOLDOWN_MS=30000`,
   `BIBLE_KWS_THRESHOLD` / `BIBLE_KWS_SCORE`.

### 2. Merge PR #3

Backend auto-deploys from `main` (Railway); frontend auto-deploys (Vercel). The updated
start command runs the model download on first boot (~100 MB, one time), then every later
boot skips it in ~1s.

### 3. Verify the deploy (Railway → Deploy Logs)

Expect, in order:

```
[models] downloading KWS model → /data/models/kws        (first boot only)
[models] downloading Whisper base.en → /data/models      (first boot only)
[models] installed keywords.txt (17 phrases)
[models] ready — KWS=/data/models/kws  MODELS=/data/models  whisperNet=true
```

then the normal backend boot. `GET /health` must still return 200 with the usual shape
(the live page checks `supabaseProjectRef` — response shape unchanged by this PR).

### 4. Live smoke test (www.parleap.com, real mic)

1. Open a live session → toggle **Bible mode ON** in the HUD.
2. STT STATUS should sit in **standby** (no ElevenLabs stream) while you talk normally.
   Backend log: `[STT] Smart Listen: stream closed (standby)`.
3. Say: **"Open Bible — John chapter 3 verse 16."**
   Expect: wake fires → `[STT] Smart Listen: STT window opened for 30000ms` → verse projects.
4. Negative check: say "Barnabas is first" → nothing should project (stopword-alias
   phantom fix), and no window should stay open past 30 s.
5. Switch back to a song item → continuous STT resumes (lyric following unchanged).

### 5. Rollback (instant, no code revert)

Set `BIBLE_SMART_LISTEN_ENABLED=false` on the backend service and restart. That is the
server kill switch: Bible mode returns to today's continuous-STT behavior. Song mode was
never touched. (Full revert = revert the merge commit; the volume/models can stay.)

## Cost effect

- Before: Bible mode streams ElevenLabs for the entire service (~2 h paid STT per event).
- After: a few 30 s windows per sermon; KWS + Whisper run locally on the Railway CPU (free).
- New fixed cost: 1 GB volume (cents/month).
