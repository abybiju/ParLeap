# Bible Operator Controls (shipped 2026-08-21)

Operator override for Bible mode that keeps detection running underneath. Closes the biggest
visible gap vs RhemaCast (see `COMPETITOR_RHEMACAST_2026-08.md`, plan item 1).

## What the operator sees

In Bible mode the center panel shows a **BibleControls** strip above the next-verse preview
(`frontend/components/operator/BibleControls.tsx`):

- **On screen** — current reference, *why* it is there (Heard reference / Matched by words /
  Auto-advanced / Operator / Undo), and a confidence badge (green ≥85%, amber ≥65%, red below).
- **◀ ▶** — previous / next verse. Next rolls into the following chapter; previous stops at
  verse 1 of the chapter.
- **Hold** — pins the current verse. Detection keeps listening; a detected reference shows as
  **Up next … [Show now]** instead of being projected. Release to resume auto projection.
- **Undo** — re-projects the previous verse (history depth 50).
- **Also considered** — up to 3 alternative candidates with scores; click to project.

Keyboard (session active, focus not in an input): `←` / `→` prev/next (verse in Bible mode,
slide otherwise), `H` toggle hold, `U` undo.

The existing Prev/Next dock buttons also step verses while a verse is on screen in Bible mode
(`MANUAL_OVERRIDE NEXT_SLIDE/PREV_SLIDE` is routed to verse navigation server-side).

## Protocol

Client → server `BIBLE_CONTROL` (`backend/src/types/schemas.ts` `BibleControlSchema`):

```json
{ "type": "BIBLE_CONTROL", "payload": { "action": "NEXT_VERSE" | "PREV_VERSE" | "HOLD" | "UNDO" | "PROJECT_REF",
  "hold": true, "ref": { "book": "John", "chapter": 3, "verse": 16, "endVerse": 18 } } }
```

Server → all event clients `BIBLE_STATUS` (broadcast on every projection, hold change, held
detection, and when leaving Bible mode):

```json
{ "type": "BIBLE_STATUS", "payload": { "currentRef": {...}, "currentLabel": "John 3:16",
  "source": "spoken|content|follow|manual|undo|setlist", "confidence": 0.93,
  "candidates": [{ "book": "John", "chapter": 3, "verse": 16, "label": "John 3:16", "score": 0.93, "text": "…" }],
  "hold": false, "canUndo": true, "historyDepth": 2, "heldDetection": null, "updatedAt": 0 } }
```

## Backend shape

`backend/src/websocket/handler.ts`:

- `projectBibleVerse(session, ref, opts)` — the single projection path for spoken refs, content
  matches, follow advances, operator steps and undo. Builds `DISPLAY_UPDATE` (+ next-verse
  preview, `matchConfidence`), updates follow/dedup state, pushes history, broadcasts
  `BIBLE_STATUS`. Replaced four duplicated `DISPLAY_UPDATE` blocks.
- `handleBibleControl` / `stepBibleVerse` — control actions.
- `recordHeldDetection` — HOLD path for detections.
- Confidence sources: `analyzeReference().score` (1.0 for exact book match) for spoken refs;
  cosine score for content matches (`findVerseByContent` now returns `topMatches`);
  next-verse score for follow advances.
- Session fields: `bibleHold`, `bibleHistory`, `bibleStatus`.

Tests: `backend/src/__tests__/unit/bibleControl.test.ts` (project / step / chapter rollover /
range error / MANUAL_OVERRIDE routing / hold + undo) and schema cases in `websocket.test.ts`.

## Known limits / next

- PREV across a chapter boundary is not supported (chapter lengths aren't indexed).
- Candidates for spoken references are a single entry (the parser returns one validated ref);
  richer alternatives arrive with plan item 4 (paraphrase as first-class trigger).
- `BIBLE_STATUS` is in-memory only; plan item 2 (verse history / session log) persists it.

## Session log / verse history (item 2, shipped 2026-08-21)

- **Table** `public.bible_projection_log` — `supabase/migrations/026_bible_projection_log.sql`.
  One row per projection *and* per held detection (`projected=false`): ref, version, `source`,
  `confidence`, `transcript_snippet` (last ≤240 chars heard), `session_id`. Inserted by the backend
  (service role) fire-and-forget in `appendBibleLog()`; a missing table logs one warning and the
  live path is unaffected. RLS: users read/delete their own rows.
- **Live panel** — `BibleHistoryPanel` in the HUD left column (Bible mode only): newest first,
  time · ref · how (heard/words/auto/you/undo/held) · confidence; click to re-project. Fed by
  `BIBLE_STATUS.recent` (last 25, in-memory — works even before the migration is applied).
- **Post-service review** — event page → sidebar **Verse Log** (`BibleLogView`): totals
  (shown / auto-detected % / operator / held), most-quoted books, per-session table with
  transcript snippet, CSV export. This table is also the detection eval dataset:
  `source`+`confidence`+`transcript_snippet` vs. what the operator corrected.
