# Session Summary — Jan 19, 2026

## ✅ High-Level Outcome
- ElevenLabs realtime STT is now working end-to-end.
- PCM audio capture is enabled in the frontend for ElevenLabs.
- Backend streaming to ElevenLabs is active in Railway.
- Ghost Text now reflects live voice input.

---

## ✅ Key Changes Applied

### Frontend
- `frontend/lib/hooks/useAudioCapture.ts`
  - Added PCM audio capture path.
  - Stabilized audio level monitoring.
  - Queued audio now preserves format metadata.
- `frontend/components/WebSocketTest.tsx`
  - Shows current STT provider and PCM mode indicator.
  - Uses PCM path when `NEXT_PUBLIC_STT_PROVIDER=elevenlabs`.

### Backend
- `backend/src/services/sttService.ts`
  - Added ElevenLabs realtime streaming client.
  - Added `STT_PROVIDER` switching and ElevenLabs env config.
- `backend/src/websocket/handler.ts`
  - Streams PCM audio to ElevenLabs.
  - Reuses existing transcript flow for matching.
  - Fixed TS7006 on stream callback params.

---

## ✅ Deployment Status

### Railway (Backend)
- Running and active.
- Logs show: **“ElevenLabs Speech-to-Text enabled.”**
- Node upgraded to **20** after switching to Nixpacks.

### Vercel (Frontend)
- `/test-websocket` shows **STT Provider: elevenlabs (PCM mode)**.
- Live transcription verified in Ghost Text.
- Custom domain setup in progress:
  - `www.parleap.com` valid
  - `parleap.com` generating SSL (redirects to www)

---

## ✅ Environment Variables Used

### Railway Backend
```
STT_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=...
ELEVENLABS_MODEL_ID=scribe_v2_realtime
ELEVENLABS_LANGUAGE_CODE=en
ELEVENLABS_COMMIT_STRATEGY=vad
SUPABASE_FALLBACK_TO_MOCK=true

# Matcher Tuning (Optional)
MATCHER_SIMILARITY_THRESHOLD=0.7
MATCHER_MIN_BUFFER_LENGTH=3
MATCHER_BUFFER_WINDOW=100
MATCHER_ALLOW_PARTIAL=false
```

### Vercel Frontend
```
NEXT_PUBLIC_STT_PROVIDER=elevenlabs
NEXT_PUBLIC_WS_URL=wss://parleapbackend-production.up.railway.app
```

---

## ✅ Verified Tests
- WebSocket connects on `/test-websocket`
- Audio level meter animates
- Live voice transcription appears in Ghost Text

---

## ⚠️ Next Steps
1. Wait for apex SSL to finish for `parleap.com`.
2. Verify redirects and HTTPS for apex + www.
3. Restore Supabase and use a real event ID.
4. Validate matching and auto-advance with real lyrics.

