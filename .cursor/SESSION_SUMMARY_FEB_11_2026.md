# Session Summary - February 11, 2026

## Overview
Continued work on Smart Bible Listen feature and Bible items in live setlist. Identified and attempted to fix root cause of Bible items not appearing in live session (PostgREST INNER JOIN issue). Feature is partially working — backend fix deployed but needs further debugging in next session.

---

## Work Completed

### 1. Bible Items Missing from Live Setlist — Root Cause Analysis
**Status**: ⚠️ Fix deployed, needs verification

**Problem**: 
Bible items showed in the setlist builder and pre-session view but disappeared after clicking "Start Session". Only 3 SONG items appeared instead of 4 (3 songs + 1 Bible).

**Root Cause Identified**:
The backend `eventService.ts` used a Supabase query with `songs(id, title, artist, lyrics, slide_config)` embed. PostgREST's schema cache may still think `song_id` is NOT NULL (from original migration 001), causing it to use INNER JOIN for the `songs()` embed. This filters out Bible items where `song_id IS NULL`.

**Fix Applied**:
- **Split the query** into two separate Supabase calls:
  1. `event_items` without `songs()` embed (guarantees all rows including Bible/Media)
  2. `songs` fetched separately by their IDs
- Added detailed logging to trace what the backend fetches
- Removed unused `EventItem` types

**Commit**: `3097cd0` → `0969d78` (rebased) — "fix: Bible items excluded by PostgREST INNER JOIN + Smart Listen gate"

---

### 2. Smart Listen Gate — Env Var No Longer Required
**Status**: ✅ Complete

**Problem**:
- Smart Listen toggle ON in UI, but AI still listening to everything
- "Listen now" button showed error: "STT_WINDOW_UNSUPPORTED: Smart Listen is disabled"
- Root cause: `BIBLE_SMART_LISTEN_ENABLED` env var was not set on Railway

**Fix Applied**:
- Changed from opt-in (`BIBLE_SMART_LISTEN_ENABLED=true` required) to kill-switch (`BIBLE_SMART_LISTEN_ENABLED=false` to force-disable)
- Smart Listen now works when the **client** enables it via the toggle, no server env var needed
- `handleSttWindowRequest` checks `session.smartListenEnabled` instead of env var

**Files**: `backend/src/websocket/handler.ts`

---

### 3. Frontend Resilience — Bible Item Merge & Local Tracking
**Status**: ✅ Complete

**Fixes Applied**:

**SetlistPanel.tsx**:
- After building display items from cached setlistItems, checks if any Bible/Media items from `initialSetlist` are missing
- Merges missing items at correct positions by `sequenceOrder`
- Added `onItemActivated` callback prop for Smart Listen gate

**OperatorHUD.tsx**:
- `currentItemIsBible` now falls back to `initialSetlist` when backend setlistItems don't include Bible
- `handleItemActivated` callback immediately sets `currentItemIsBible` when operator clicks a setlist item (no waiting for backend round-trip)

---

### 4. Debug Endpoint Added
**Status**: ✅ Deployed

Added temporary diagnostic endpoint to verify backend Supabase query results:
```
GET /api/debug/event-items/:eventId
```
Returns raw `event_items` rows with `item_type`, `song_id`, `bible_ref`, etc.

**Commit**: `b435214` — "chore: add debug endpoint for event_items diagnosis"

---

## Commits (All Pushed)

| Hash | Message |
|------|---------|
| `3097cd0` | fix: Bible items excluded by PostgREST INNER JOIN + Smart Listen gate |
| `b435214` | chore: add debug endpoint for event_items diagnosis |

## Files Modified

**Backend**:
- `backend/src/services/eventService.ts` — Split query (no songs() embed), added logging
- `backend/src/websocket/handler.ts` — Smart Listen kill-switch instead of opt-in
- `backend/src/index.ts` — Debug endpoint

**Frontend**:
- `frontend/components/operator/SetlistPanel.tsx` — Merge missing Bible/Media items, onItemActivated callback
- `frontend/components/operator/OperatorHUD.tsx` — Resilient currentItemIsBible tracking

---

## Outstanding Issues

### Bible Items Still Not Showing After Deploy ❌
- CI passed (`3097cd0` success at 06:03 UTC)
- Backend health endpoint responding
- User reports Bible still not visible in live setlist after restarting session
- **Debug endpoint deployed** — needs user to test with event ID to verify raw data
- **Possible causes**:
  - Railway deployment not yet complete at time of testing
  - Supabase query returning unexpected results
  - Frontend merge logic not executing (needs browser console debugging)

### Next Steps for Debugging
1. Test debug endpoint: `https://parleapbackend-production.up.railway.app/api/debug/event-items/EVENT_ID`
2. Check browser console for `[SetlistPanel]` and `[EventService]` logs
3. If debug endpoint shows Bible item, issue is frontend; if not, issue is Supabase query
4. Remove debug endpoint after diagnosis

---

## Technical Insights

### PostgREST Schema Cache Issue
- Original schema: `song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL`
- Migration 011: `ALTER COLUMN song_id DROP NOT NULL`
- PostgREST may cache the NOT NULL constraint → uses INNER JOIN for `songs()` embed → Bible items (song_id=NULL) excluded
- Fix: Avoid `songs()` embed entirely, use separate queries
- Alternative fix (for future): `NOTIFY pgrst, 'reload schema'` to force cache refresh

### Smart Listen Architecture
- **Frontend gate**: `useAudioCapture` buffers audio when `smartListenEnabled && currentItemIsBible`
- **Backend gate**: `shouldUseSmartListenGate()` drops audio unless STT window is open
- **Trigger**: Wake word detection OR "Listen now" button → `STT_WINDOW_REQUEST`
- **Kill switch**: `BIBLE_SMART_LISTEN_ENABLED=false` on server to force-disable
