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
# Optional: model and language (defaults: scribe_v2_realtime, en)
# ELEVENLABS_MODEL_ID=scribe_v2_realtime
# ELEVENLABS_LANGUAGE_CODE=en
# ELEVENLABS_COMMIT_STRATEGY=vad   # or "manual"
```

**Optional – VAD tuning (background noise vs speech/singing):**  
When `commit_strategy=vad`, the API uses Voice Activity Detection to decide when to commit transcripts. You can tune it via env (omit to use API defaults):

| Variable | Default | Purpose |
|----------|---------|---------|
| `ELEVENLABS_VAD_THRESHOLD` | 0.4 | Speech detection sensitivity. **Higher** = less sensitive = more rejection of low-level noise. |
| `ELEVENLABS_VAD_SILENCE_THRESHOLD_SECS` | 1.5 | Seconds of silence before committing. Longer = fewer commits during short pauses. |
| `ELEVENLABS_MIN_SPEECH_DURATION_MS` | 100 | Min speech duration (ms) before treating as real speech. Helps ignore short noise bursts. |
| `ELEVENLABS_MIN_SILENCE_DURATION_MS` | 100 | Min silence duration (ms) to count as a boundary. |

**Recommended for smooth STT and noise rejection (set in backend/.env or Railway):**
```bash
ELEVENLABS_VAD_THRESHOLD=0.5
ELEVENLABS_VAD_SILENCE_THRESHOLD_SECS=1.2
ELEVENLABS_MIN_SPEECH_DURATION_MS=150
ELEVENLABS_MIN_SILENCE_DURATION_MS=120
```

**Tuning tips:**
- **Too many false commits from noise:** Increase `ELEVENLABS_VAD_THRESHOLD` (e.g. 0.5–0.6) and/or `ELEVENLABS_MIN_SPEECH_DURATION_MS` (e.g. 150–200).
- **Speech/singing cut off too early:** Decrease `ELEVENLABS_VAD_THRESHOLD` slightly or increase `ELEVENLABS_VAD_SILENCE_THRESHOLD_SECS`.
- **Singing with long held notes:** Use a slightly longer `ELEVENLABS_VAD_SILENCE_THRESHOLD_SECS` so a brief breath doesn’t commit mid-phrase.

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

### 6. WebSocket rate limits (backend)

The backend rate-limits WebSocket messages to prevent abuse. **Audio** is limited per 10s window so continuous STT does not trigger "Rate limited" toasts.

| Variable | Default | Purpose |
|----------|---------|---------|
| `WS_RATE_LIMIT_WINDOW_MS` | 10000 | Rate-limit window in ms (10s). |
| `WS_RATE_LIMIT_CONTROL` | 100 | Max control messages (e.g. PING, MANUAL_OVERRIDE) per window. |
| `WS_RATE_LIMIT_AUDIO` | 400 | Max AUDIO_DATA messages per window. PCM at ~15 chunks/sec needs ~150 in 10s; 400 allows headroom and bursts. |

If you see "Rate limited" in the Operator app during normal singing, ensure the backend is using the default 400 for `WS_RATE_LIMIT_AUDIO` (or set it explicitly, e.g. 500). Do not set it below ~180 for continuous STT.

### 7. Smart Bible Wake Word (backend)

In **Bible mode** the backend runs an always-on keyword-spotter (sherpa `KeywordSpotter`) over the
mic. A spotted scripture cue ("turn to…", "open your bibles to…") opens a short accurate ElevenLabs
window, then `parseForProject()` decides the screen. Song/lyric mode is unaffected (continuous STT).
Models are **not** in the image — run `backend/scripts/download-models.sh` on first boot to fetch them
to a persistent volume (Railway Volume), then start the backend.

| Variable | Default | Purpose |
|----------|---------|---------|
| `BIBLE_SMART_LISTEN_ENABLED` | (unset = on) | Master kill switch. Set `false` to force continuous STT and disable the detector everywhere. |
| `BIBLE_SMART_LISTEN_WINDOW_MS` | 30000 | Accurate-capture window length (ms) after a wake. |
| `BIBLE_DETECTOR_ENABLED` | (unset = on) | Backend wake-word detector on/off. `false` = windows only open from the client (manual button). |
| `BIBLE_DETECTOR_WHISPER_NET` | `true` | **Option A.** Keep the VAD+Whisper un-cued safety net on (catches references with no lead-in). `false` = wake-word only (lighter CPU, misses un-cued refs). |
| `BIBLE_DETECTOR_MODEL` | `base.en` | Whisper model for the net (`tiny.en`/`base.en`/`small.en`). |
| `BIBLE_DETECTOR_MODELS_DIR` | `/data/models` | Volume dir for Whisper + `silero_vad.onnx`. |
| `BIBLE_KWS_MODELS_DIR` | `<MODELS_DIR>/kws` | Keyword-spotter model dir (own subdir — encoder filename collides with Whisper otherwise). |
| `BIBLE_KWS_KEYWORDS_FILE` | `<KWS_DIR>/keywords.txt` | Tokenized wake vocabulary. Generated from `backend/config/bible-wake-phrases.txt` via `backend/scripts/kws_text2token.py`; the download script installs it. |
| `BIBLE_KWS_THRESHOLD` | model default | Global wake sensitivity (higher = fewer false wakes). Per-phrase `#threshold` in the keywords file overrides. |
| `BIBLE_KWS_SCORE` | model default | Global wake boost (higher = easier to fire). |
| `BIBLE_DETECTOR_COOLDOWN_MS` | 30000 | Min gap between detector-opened windows. |

**First-boot (Railway):** run the model download once, then start:
```bash
bash backend/scripts/download-models.sh && npm --workspace=backend start
```
False wakes are cheap by design (an invisible window; `parseForProject` still gates the screen), so
bias `keywords.txt` toward recall and tune thresholds against a **real recorded service**.
