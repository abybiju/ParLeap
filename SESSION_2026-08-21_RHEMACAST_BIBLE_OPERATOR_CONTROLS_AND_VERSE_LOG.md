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
