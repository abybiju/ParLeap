# Current State Checkpoint (Pre–Smart Audio)

**Purpose:** If Smart Audio implementation causes issues, use this document to restore the system to the state below. Do not delete this file until Smart Audio is stable.

**Checkpoint date:** 2026-02-10  
**Git commit:** `8a57809`  
**Branch:** `main`

---

## How to revert

### Option 1: Revert code to this commit
```bash
git checkout 8a57809
# Or to create a new branch from this state:
git checkout -b rollback-pre-smart-audio 8a57809
```

### Option 2: If Smart Listen is behind a feature flag
- Set `BIBLE_SMART_LISTEN_ENABLED=false` (backend env) or turn off "Smart Listen" in Operator HUD so "Always Listen" (full STT) is used. That restores current behavior without reverting commits.

---

## Current behavior (do not break)

### SONG (current setlist item is a song)
- Audio is streamed from browser to backend via `AUDIO_DATA` messages.
- Backend lazily creates ElevenLabs STT stream on first audio chunk (in `handleAudioData`), then forwards all audio to ElevenLabs.
- Matching runs against song lines; `DISPLAY_UPDATE` and `SONG_CHANGED` are sent as today.

### BIBLE (current setlist item is Bible)
- Same as SONG: audio streamed via `AUDIO_DATA`; backend creates ElevenLabs stream on first chunk and keeps it running.
- Bible follow logic (verse matching, debounce) runs in handler. No "gatekeeper" or selective STT yet.

### Real-time layer
- **Protocol:** Native WebSocket (`ws`). No Socket.io.
- **Message types:** `START_SESSION`, `AUDIO_DATA`, `MANUAL_OVERRIDE`, `STOP_SESSION`, `PING`, plus server messages (`SESSION_STARTED`, `TRANSCRIPT_UPDATE`, `DISPLAY_UPDATE`, `SONG_CHANGED`, etc.).
- **Database:** Supabase client only. No Prisma.

---

## Key files (minimal set that defines current behavior)

| File | Role |
|------|------|
| `backend/src/websocket/handler.ts` | Session lifecycle, `handleAudioData` → lazy `initElevenLabsStream`, matching, broadcast, `handleStartSession`, `handleStopSession` |
| `backend/src/services/sttService.ts` | `createStreamingRecognition()` – ElevenLabs WebSocket, stream start/stop |
| `frontend/lib/hooks/useAudioCapture.ts` | Captures mic, sends `AUDIO_DATA`; no ring buffer, no wake word |
| `frontend/lib/websocket/types.ts` | Client-side WebSocket message types |
| `backend/src/types/websocket.ts` | Server-side WebSocket message types and payloads |
| `backend/src/types/schemas.ts` | Zod schemas for message validation |
| `frontend/components/operator/OperatorHUD.tsx` | Operator HUD; no Smart Listen toggles yet |
| `frontend/components/operator/SetlistPanel.tsx` | Setlist display (SONG/BIBLE/MEDIA) |

---

## Environment variables that matter (current)

- **Backend:** `ELEVENLABS_API_KEY`, `CORS_ORIGIN`, `PORT`, Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), Bible/ESV vars as needed.
- **Frontend:** `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STT_PROVIDER`.
- No Smart Listen–specific env vars yet.

### Matcher tuning (optional, for inconsistent matching)
| Env | Default | Effect |
|-----|---------|--------|
| `MATCHER_SIMILARITY_THRESHOLD` | 0.55 | Lower = more sensitive (risk: false advances) |
| `MATCHER_PREPROCESS_MAX_WORDS` | 22 | Words used from transcript for matching |
| `MATCHER_END_TRIGGER_DEBOUNCE` | 1 | Consecutive end-word hits to advance (1 = faster) |
| `MATCHER_MIN_BUFFER_LENGTH` | 2 | Min words before attempting match |
| `DEBUG_MATCHER` | false | Set `true` for verbose match logs |

---

**After Smart Audio:** New message type(s) (e.g. `STT_WINDOW_REQUEST`), optional ring buffer and `useBibleWakeWord` in frontend, and conditional ElevenLabs start in handler when Smart Listen is on and current item is BIBLE. Default and kill switch must preserve the behavior described above.
