# Session 2026-08-20/21 — RhemaCast competitive analysis → Bible operator controls + verse log

## What happened
1. **Competitive analysis of rhemacast.io** (`COMPETITOR_RHEMACAST_2026-08.md`). Verdict: their detection core ≈ ours;
   they win on operator workflow + OBS overlay; they have no projector output and no lyrics. Verse detection is
   commoditized (~9 entrants incl. open-source Rhema). Our moat stays live lyric-following + one hands-free service.
   Produced a 7-item plan; agreed to work it in order.
2. **Item 1 shipped — Bible operator controls** (commit `3869c70`, live on Railway + Vercel, CI green).
   `BIBLE_CONTROL` / `BIBLE_STATUS` WS messages, `projectBibleVerse()` single projection path (replaced 4 duplicated
   blocks), HOLD (detections queue as "Up next"), ◀▶ verse stepping (also via Prev/Next + arrow keys), UNDO,
   confidence + candidates in the HUD. Doc: `BIBLE_OPERATOR_CONTROLS.md`.
3. **Item 2 shipped — verse history / session log** (commit `1ec9828`).
   `bible_projection_log` table (migration 026), `appendBibleLog()` (in-memory + fire-and-forget insert),
   `BIBLE_STATUS.recent`, HUD `BibleHistoryPanel` (click to re-project), event sidebar **Verse Log** review view
   with stats + CSV export.

## ACTION REQUIRED (Aby)
- **Apply migration `supabase/migrations/026_bible_projection_log.sql` in the Supabase SQL editor** (project
  ypbqqwevnxqnooplvdyn). The local Supabase CLI is logged into a different account (Dexavox/Tubemeter), so it
  couldn't be pushed from here. Until applied: HUD history still works (in-memory), the backend logs one warning
  per process, and the Verse Log page shows "table not set up yet".
- Live drill on prod: Bible mode → say "John three sixteen" → press **H** → say another reference → "Show now"
  → **U**. Then open the event page → Verse Log.

## Verification record
- backend `tsc` clean; frontend `tsc` + ESLint clean.
- New tests: `backend/src/__tests__/unit/bibleControl.test.ts` (6 passing, incl. session-log ordering) + 2
  `BIBLE_CONTROL` schema tests.
- Full backend suite: `18 failed / 149 passed` — the 18 are PRE-EXISTING on main (`eventService.test.ts`,
  `websocket.test.ts`: stale mocks, `handleMessage` called without `userId`). Worth a cleanup pass.

## Next session — plan items 3–7
3. Sermon-notes → BIBLE setlist queue (paste notes → `bible-passage-reference-parser` → items); follow logic
   prefers queued refs (also the fix for unreliable cross-chapter jumps).
4. Paraphrase as first-class trigger with a LOCAL embedding model (drop OpenAI call); auto-project high, suggest low.
5. Self-correction ("sorry, I mean…") in the parser.
6. `/overlay/[id]` transparent OBS/vMix browser-source route (Bible + lyrics).
7. Custom vocabulary → ElevenLabs keyterms + alias table.
Known limits carried: PREV doesn't cross chapter boundaries backwards; spoken refs yield one candidate until item 4.

## Addendum 2026-08-22 — "ElevenLabs stream error" after silence (fixed, `3e067a6`)
Root cause: ElevenLabs ends a Smart Listen window with `insufficient_audio_activity` when nobody speaks
(or the mic is paused); we had that message type on the error list → red STT_ERROR toast for a routine event.
Now: `insufficient_audio_activity` / `session_time_limit_exceeded` → quiet 'end', window drops back to standby so
the wake detector re-arms. Also removed the dead `127.0.0.1:7243/ingest` debug fetches (frontend ×2, backend ×2)
that flooded the console with ERR_CONNECTION_REFUSED. Deployed; Railway/Vercel/CI green.

## Addendum 2026-08-22 (2) — console cleanup (`13e126d`)
- Mic PCM capture moved from deprecated ScriptProcessorNode to an **AudioWorklet**
  (`frontend/public/audio/pcm-capture-processor.js`, same 1024-sample/64 ms Int16 chunks; ScriptProcessor kept as fallback).
- Login/signup three.js canvas: `FrameloopGuard` stops rendering at 0×0 (killed the WebGL framebuffer warning flood on
  navigation to /dashboard).
- SetlistPanel accepts generic Bible segments without a reference (label "Bible") and no longer logs a merge on every
  WS message.
- Migration 026 applied to prod by Aby (SQL editor). Frontend vitest: 23 pre-existing failures on main
  (`client.test.ts`, `SongEditorModal.test.tsx`), none new.

## Addendum 2026-08-22 (3) — live verification + LatencyTracker (`500a6d4`)
Verified on prod via Chrome: AudioWorklet capture active, spoken "Sam's 141" → Psalms 141:1 projected, H/→/U controls
round-trip, Verse History + event Verse Log (DB) populated, console error-free. Then fixed `LatencyTracker`: receive IDs
never matched send IDs (warned on every server push, measured nothing) — now measures from server timing when there is no
correlated send; send-timestamp Map capped at 256 (was unbounded, fed by every AUDIO_DATA chunk).
