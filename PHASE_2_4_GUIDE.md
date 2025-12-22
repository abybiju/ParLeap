# Phase 2.4: AI Transcription Integration (Google Cloud Speech-to-Text)

**Status:** 🚀 In Progress  
**Started:** December 20, 2025  
**Provider:** Google Cloud Speech-to-Text API

---

## 🎯 Objective

Connect live audio streaming from frontend microphone → WebSocket → Google Cloud STT → Real-time transcription display.

**Expected Latency:** <500ms end-to-end (audio capture → transcription → display)

---

## 📋 Setup Checklist

### Step 1: Google Cloud Project Setup (15 mins)

#### 1.1 Create GCP Project
```bash
# Go to: https://console.cloud.google.com/
# Click "Select a project" → "New Project"
# Name: "parleap-ai" (or your choice)
# Click "Create"
```

#### 1.2 Enable Speech-to-Text API
```bash
# In GCP Console:
# Navigate to: APIs & Services → Library
# Search: "Cloud Speech-to-Text API"
# Click "Enable"
```

#### 1.3 Create Service Account
```bash
# Navigate to: IAM & Admin → Service Accounts
# Click "Create Service Account"
# Name: "parleap-stt-service"
# Role: "Cloud Speech Client" (or "Cloud Speech Administrator")
# Click "Create and Continue" → "Done"
```

#### 1.4 Generate API Key
```bash
# Click on the service account you just created
# Go to "Keys" tab
# Click "Add Key" → "Create new key"
# Choose JSON format
# Download the JSON file
# Save it as: backend/config/google-cloud-credentials.json
```

⚠️ **IMPORTANT**: Add to `.gitignore`:
```
backend/config/google-cloud-credentials.json
```

#### 1.5 Set Environment Variable
Add to `backend/.env`:
```env
GOOGLE_APPLICATION_CREDENTIALS=./config/google-cloud-credentials.json
```

---

## 🏗️ Architecture

```
┌─────────────┐  Audio Chunks   ┌─────────────┐  Binary Audio   ┌──────────────┐
│  Frontend   │ ─────────────→  │  WebSocket  │ ──────────────→ │  STT Service │
│ (Microphone)│   (Base64)      │   Handler   │   (Buffer)      │ (Google API) │
└─────────────┘                 └─────────────┘                 └──────────────┘
                                                                        │
                                                                        ↓
┌─────────────┐  TRANSCRIPT     ┌─────────────┐   Transcription  ┌──────────────┐
│  Frontend   │ ←────────────── │  WebSocket  │ ←──────────────  │ Google Cloud │
│  (Display)  │    _UPDATE      │   Handler   │    (Text)        │  Speech API  │
└─────────────┘                 └─────────────┘                  └──────────────┘
```

---

## 📂 File Structure

```
backend/
├── src/
│   ├── services/
│   │   ├── sttService.ts          ✨ NEW - Google Cloud STT integration
│   │   └── eventService.ts        (existing)
│   ├── websocket/
│   │   └── handler.ts             🔧 UPDATE - Add STT integration
│   ├── types/
│   │   └── websocket.ts           🔧 UPDATE - Add TRANSCRIPT_UPDATE type
│   └── config/
│       └── google-cloud-credentials.json  🔐 (gitignored)
├── .env                           🔧 UPDATE - Add GOOGLE_APPLICATION_CREDENTIALS
└── package.json                   🔧 UPDATE - Add @google-cloud/speech
```

---

## 🔧 Implementation Steps

### Step 2: Install Dependencies
```bash
cd backend
npm install @google-cloud/speech
```

### Step 3: Create STT Service
File: `backend/src/services/sttService.ts`
- Initialize Google Cloud Speech client
- Create streaming recognition config (16kHz, mono, LINEAR16)
- Handle audio chunks (convert base64 → Buffer)
- Return transcription results with confidence scores
- Error handling and reconnection logic

### Step 4: Update WebSocket Types
File: `backend/src/types/websocket.ts`
- Add `TRANSCRIPT_UPDATE` server message type
- Include fields: `text`, `isFinal`, `confidence`

### Step 5: Integrate into WebSocket Handler
File: `backend/src/websocket/handler.ts`
- Route `AUDIO_DATA` messages to STT service
- Send `TRANSCRIPT_UPDATE` messages back to client
- Track partial vs. final transcriptions

### Step 6: Frontend Display
File: `frontend/components/operator/GhostText.tsx`
- Display live transcription text
- Show confidence meter
- Differentiate partial (gray) vs. final (white) text

---

## 🧪 Testing Plan

### Unit Tests
- [ ] STT service can connect to Google API
- [ ] Audio buffer conversion (base64 → Buffer) works
- [ ] Handles API errors gracefully
- [ ] Reconnects on connection loss

### Integration Tests
- [ ] WebSocket sends AUDIO_DATA correctly
- [ ] Backend forwards to Google Cloud
- [ ] TRANSCRIPT_UPDATE received by frontend
- [ ] End-to-end latency <500ms

### Manual Testing
- [ ] Speak into microphone → see transcription
- [ ] Test with background noise
- [ ] Test with different accents
- [ ] Test rapid speech vs. slow speech

---

## 🎯 Success Criteria

✅ Audio chunks stream from frontend → backend  
✅ Google Cloud STT receives and processes audio  
✅ Transcription appears in real-time (<500ms)  
✅ Confidence scores displayed accurately  
✅ System handles errors gracefully (API failures, network issues)  
✅ No memory leaks with long-running sessions  

---

## 📊 Expected Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Audio Capture | 1000ms chunks | MediaRecorder config |
| WebSocket Latency | <10ms | Already achieved |
| STT Processing | 200-300ms | Google Cloud typical |
| Total End-to-End | <500ms | Capture → Display |
| Accuracy | >90% | Clear audio, standard English |

---

## 🚨 Common Issues & Solutions

### Issue: "Application Default Credentials not found"
**Solution:** Ensure `GOOGLE_APPLICATION_CREDENTIALS` env var points to correct JSON file

### Issue: "Audio encoding not supported"
**Solution:** Verify audio format: LINEAR16, 16kHz, mono

### Issue: High latency (>1 second)
**Solution:** Check chunk size (reduce to 500ms), verify network connection

### Issue: Low transcription accuracy
**Solution:** Improve microphone quality, reduce background noise, adjust sample rate

---

## 💰 Cost Estimation

**Google Cloud Speech-to-Text Pricing:**
- $0.024 per 15 seconds (standard models)
- $0.048 per 15 seconds (enhanced models)

**Example Usage:**
- 1-hour service: ~$5.76 (standard) or ~$11.52 (enhanced)
- Monthly (50 hours): ~$288 (standard) or ~$576 (enhanced)

**Cost Optimization:**
- Use standard models for most cases
- Only upgrade to enhanced for critical events
- Cache/reuse transcriptions where possible

---

## 🔐 Security Considerations

1. **API Keys**: Never commit credentials to Git
2. **Service Account**: Use least-privilege roles
3. **Rate Limiting**: Implement to prevent abuse
4. **Audio Data**: Don't log/store sensitive audio without consent
5. **HTTPS**: Always use secure connections in production

---

## 📚 Resources

- [Google Cloud Speech-to-Text Docs](https://cloud.google.com/speech-to-text/docs)
- [Streaming Recognition Guide](https://cloud.google.com/speech-to-text/docs/streaming-recognize)
- [Best Practices](https://cloud.google.com/speech-to-text/docs/best-practices)
- [Pricing Calculator](https://cloud.google.com/products/calculator)

---

**Next Steps:** Follow the implementation in order (Setup → Install → Build → Test)

