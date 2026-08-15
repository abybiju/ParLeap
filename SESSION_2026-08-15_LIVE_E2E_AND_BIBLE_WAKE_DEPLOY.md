# Session log — 2026-08-15: Live E2E test + Smart Bible wake word SHIPPED to production

## What shipped (all live on www.parleap.com)

1. **PR #3 merged & deployed — Smart Bible wake word (Option A: KWS + Whisper net).**
   Bible mode no longer streams paid ElevenLabs STT continuously: a free on-CPU
   sherpa KeywordSpotter + Silero-VAD/Whisper safety net listen locally and open a
   30 s paid window only on a scripture cue. Verified live: "open Bible" fires and
   the verse projects (owner-confirmed).
2. **Deliberate wake commands** "OPEN BIBLE" / "OPEN THE BIBLE" (commit `7e72227`)
   — KWS-bench verified 6/6 positive (2 voices, isolated + mid-sentence), 0/4 false
   fires on near-misses.
3. **PR #4 merged & deployed — voice-driven bible/song mode switching.**
   - Song mode: "open bible" in the lyric transcript flips Bible mode ON for all
     clients (HUD toggle follows) and reuses the open stream as the capture window
     ("open bible John chapter 3 verse 16" works in one breath).
   - Bible mode: "close bible" switches back — scanned in window transcripts AND
     spotted in standby by new `CLOSE_BIBLE`/`CLOSE_THE_BIBLE` keywords routed to
     `onCloseCommand` (no paid window). Restores the current slide + 20 s
     backward-match grace.
   - Setlist agrees with modes: activating a SONG item exits Bible mode; activating
     a BIBLE item (with or without preset ref) arms it.
   - Anti-flap: later spoken command wins in cumulative STT text
     (`bibleVoiceCommands.ts`), 5 s cooldown. 77 unit tests green.
4. **Live lyric-following E2E on production: PASSED.** Amazing Grace sung end-to-end;
   AI matched 100%, auto-advanced through all 4 slides (advances at 1:01:30 /
   1:01:51 / 1:01:59 in the console trace).

## Deployment infrastructure (Railway backend) — done this session

- Volume mounted at **`/data`** (models persist; whisper base.en + KWS + silero ≈100 MB).
- Env: `BIBLE_SMART_LISTEN_ENABLED=true`, `BIBLE_DETECTOR_MODELS_DIR=/data/models`,
  `BIBLE_DETECTOR_WHISPER_NET=true`.
- **Gotcha found: the dashboard "Custom Start Command" overrides `nixpacks.toml`/
  `backend/railway.toml`.** It is now:
  `bash backend/scripts/download-models.sh; npm run start --workspace=@parleap/backend`
  (Railway's parser rejects `(subshell)` syntax — plain `;` keeps the download
  non-fatal).
- **Gotcha: runtime image had no bzip2** (model tarballs are .tar.bz2) → `tar:
  Child died with signal 13` + curl error 23 on first boot. Fixed in
  `nixpacks.toml` `aptPkgs = ["ffmpeg", "bzip2"]` (commit `709aff0`).
- Watch paths now include **`/nixpacks.toml`** (root-config commits were SKIPPED as
  "no changes to watched files" before).
- Rollback for the wake system: set `BIBLE_SMART_LISTEN_ENABLED=false` + restart.
- Full runbook: `DEPLOYMENT_BIBLE_WAKE.md`.

## Production bug found & hot-fixed (root cause still open)

**Signup never creates a `profiles` row** (`supabase.auth.signUp` only; no DB
trigger, no client insert), and `songs.user_id` / `events.user_id` FK-reference
`profiles(id)` → every fresh account fails its first song create with
`songs_user_id_fkey`. This session's account was fixed by inserting the profile
row via the RLS-permitted client insert. **Proper fix TODO: `handle_new_user`
trigger migration on `auth.users`** (see supabase/MIGRATIONS.md conventions +
grants cheat-sheet).

## Findings backlog (from the pipeline audit — not yet fixed)

| Finding | Where |
|---|---|
| Every WS message handled 7× (duplicate subscriptions; SESSION_STARTED/DISPLAY_UPDATE each log 7 times) | frontend `useWebSocket` consumers |
| React error #185 (max update depth) fires on live page load | `/live/[id]` |
| Dead debug POSTs to `http://127.0.0.1:7243/ingest/…` in hot paths | `frontend/lib/hooks/useWebSocket.ts:86-103` and backend `handler.ts` GO_TO_ITEM `#region agent log` |
| Mic constraints `echoCancellation/noiseSuppression/autoGainControl` all ON — hostile to sung audio | `useAudioCapture.ts:164-172` |
| Deprecated main-thread `ScriptProcessorNode(1024)` → AudioWorklet migration | `useAudioCapture.ts:378-422` |
| `isAutoFollowing` gates song *switching* but not slide *advance* | `handler.ts` advance path |
| `endOfSlideTarget` computed only at song start/switch — stale as slides advance (weakens repeated-lyrics defense) | `matcherService.ts createSongContext` |
| LatencyTracker "No send timestamp" warning spam on every server-push message | `frontend/lib/latency/tracker.ts` |
| Matcher tuning/bench (accuracy + latency vs real singing) never started | see `backend/scripts/transcribe-full.ts` + `bench-parser.ts` pattern; real sung WAVs in `backend/songs_input/` |

## Test data created (prod account abyebez03/…)

Songs: Amazing Grace, Holy Holy Holy, It Is Well With My Soul (all public domain).
Event: "Live Follow Test" (`9ef0d2ae-ccad-40ef-a8c3-e657cd2ac1c0`) — 3 songs + Bible segment.

## Still pending

- Full live drill of PR #4 voice switching (sing → "open bible John 3:16" → toggle
  flips + verse → "close bible" → lyrics resume). Deployed and boot-verified
  (`[models] ready`, 19 keyword phrases installed); live confirmation pending.
- Multi-song mid-song switch test (sing Amazing Grace → jump into It Is Well).
- Matcher accuracy/latency bench + tuning.
- `handle_new_user` migration.
