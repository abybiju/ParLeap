# STT (Speech-to-Text) Configuration Guide

## Problem: STT Shows "Waiting for transcription..."

If your STT status shows "Waiting for transcription..." even though audio is recording, check these:

### 1. Frontend Configuration

**Required:** Set `NEXT_PUBLIC_STT_PROVIDER` in your frontend environment:

```bash
# In frontend/.env.local or Vercel environment variables
NEXT_PUBLIC_STT_PROVIDER=elevenlabs
```

**Why:** The frontend needs to know which STT provider to use so it sends the correct audio format:
- `elevenlabs` → Sends PCM 16-bit audio
- `google` or `mock` → Sends WebM Opus audio

### 2. Backend Configuration

**For ElevenLabs:**
```bash
# In backend/.env or Railway environment variables
STT_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_api_key_here
```

**For Google Cloud:**
```bash
# In backend/.env or Railway environment variables
STT_PROVIDER=google
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

### 3. Common Issues

#### Issue: Format Mismatch
**Symptom:** Backend logs show "AUDIO_FORMAT_UNSUPPORTED" error

**Cause:** Frontend and backend STT providers don't match
- Frontend: `NEXT_PUBLIC_STT_PROVIDER=mock` (sends WebM)
- Backend: `STT_PROVIDER=elevenlabs` (expects PCM)

**Fix:** Set `NEXT_PUBLIC_STT_PROVIDER=elevenlabs` in frontend

#### Issue: API Key Missing
**Symptom:** Backend logs show "ELEVENLABS_API_KEY not configured"

**Fix:** Add `ELEVENLABS_API_KEY` to backend environment variables

#### Issue: WebSocket Not Connecting
**Symptom:** STT Status shows "Waiting..." and backend logs show no ElevenLabs connection

**Check:**
1. Is `ELEVENLABS_API_KEY` valid?
2. Check backend logs for WebSocket connection errors
3. Verify network connectivity to `wss://api.elevenlabs.io`

### 4. Verification

**Check Frontend:**
- Open browser console
- Look for `[OperatorHUD]` logs showing STT provider
- Should see: `sttProvider: elevenlabs` (not `mock`)

**Check Backend Logs:**
- Look for `[STT] ✅ ElevenLabs WebSocket connected`
- Look for `[STT] 📝 ElevenLabs transcript:` messages
- If you see `[STT] ⚠️ MOCK MODE`, STT is not configured

**Check STT Status Component:**
- Should show "Active (Receiving transcripts)" when working
- Should show provider name (ElevenLabs, Google, or Mock)

### 5. Quick Test

1. Set `NEXT_PUBLIC_STT_PROVIDER=elevenlabs` in frontend
2. Set `STT_PROVIDER=elevenlabs` and `ELEVENLABS_API_KEY=...` in backend
3. Restart both frontend and backend
4. Start a session and speak/sing
5. Check browser console for `[WS] 🎤 Transcription:` messages
6. Check backend logs for `[STT] 📝 ElevenLabs transcript:` messages

If you see transcriptions in the logs, STT is working! If not, check the error messages above.
