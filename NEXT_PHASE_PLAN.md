# ParLeap - Next Phase Implementation Plan

**Last Updated:** December 22, 2025  
**Current Status:** Phase 2.4 Complete ✅ | Phase 3 Complete ✅ | Phase 3.4 Complete ✅ | READY FOR DEPLOYMENT 🚀  
**Next Focus:** Production Deployment (Railway + Vercel) → Phase 4 (ML Optimization)

### 🟢 System Status
- ✅ Backend implementation complete (Phase 2.4 + Phase 3)
- ✅ Frontend implementation complete (Phase 3.4)
- ✅ All tests passing (13/13)
- ✅ Zero TypeScript errors
- ✅ Zero linter errors
- ✅ All documentation complete
- ✅ Ready for deployment to production

---

## 🎯 Strategic Overview

We've completed the foundation and latency monitoring infrastructure. Now we need to build the **core AI functionality** that makes ParLeap work:

1. **Data Layer** (Supabase) - Real content management
2. **Audio Input** (Frontend) - Capture and stream audio
3. **AI Processing** (STT) - Convert speech to text
4. **Matching Engine** - Match transcription to slides

---

## 📋 Phase 1.2: Supabase Integration (Foundation)

**Priority:** HIGH - Needed for real data before we can test matching

### Goals
- Set up Supabase project
- Create database schema
- Initialize Supabase clients
- Replace mock data with real queries

### Tasks

#### 1.2.1 Supabase Project Setup
- [x] Create Supabase project at https://supabase.com
- [x] Get project URL and API keys
- [x] Configure environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (backend only)

#### 1.2.2 Database Schema Migration
- [x] Run migration: `supabase/migrations/001_initial_schema.sql`
- [x] Verify tables created:
  - `profiles`
  - `songs`
  - `events`
  - `event_items`
- [x] Set up Row Level Security (RLS) policies
- [x] Test RLS policies with test user

#### 1.2.3 Supabase Client Initialization
- [x] Frontend: Updated `frontend/lib/supabase/client.ts` ✅
- [x] Backend: Created `backend/src/config/supabase.ts` ✅
- [x] Test connection from both frontend and backend
- [x] Verify environment variables are set correctly

#### 1.2.4 Replace Mock Data
- [x] Backend: Created `backend/src/services/eventService.ts` ✅
- [x] Updated `handleStartSession` to fetch from Supabase ✅
  - Queries `events` table for event data
  - Queries `event_items` for setlist
  - Queries `songs` for lyrics
- [x] Parse lyrics into lines (automatic in eventService) ✅
- [x] Cache in memory (SessionState) ✅
- [x] Error handling for missing data ✅

**Estimated Time:** 2-3 hours  
**Dependencies:** None  
**Blockers:** None

---

## 📋 Phase 2.3: Audio Capture (Frontend)

**Priority:** HIGH - Core functionality for real-time processing

### Goals
- Capture audio from browser microphone
- Stream audio chunks to WebSocket
- Provide visual feedback to operator
- Handle permissions and errors gracefully

### Tasks

#### 2.3.1 Browser Microphone Access
- [x] Created `useAudioCapture` hook (`frontend/lib/hooks/useAudioCapture.ts`) ✅
- [x] Request microphone permissions ✅
- [x] Handle permission denied/blocked states ✅
- [x] Display permission request UI ✅
- [x] Error handling for unsupported browsers ✅

#### 2.3.2 MediaRecorder Setup
- [x] Initialize `MediaRecorder` API ✅
- [x] Configure audio format:
  - Sample rate: 16000 Hz (optimal for STT) ✅
  - Channels: 1 (mono) ✅
  - Encoding: WebM Opus ✅
- [x] Set up chunk size (1000ms chunks) ✅
- [x] Handle `dataavailable` events ✅

#### 2.3.3 Audio Streaming to WebSocket
- [x] Convert audio chunks to Base64 ✅
- [x] Send via `AUDIO_DATA` message type ✅
- [x] Include audio metadata (sample rate, format) ✅
- [x] Handle WebSocket disconnection during streaming ✅
- [x] Queue chunks if WebSocket is temporarily disconnected ✅

#### 2.3.4 Visual Feedback Components
- [x] Created `AudioLevelMeter` component ✅
  - Visual waveform with animated bars ✅
  - Real-time audio level visualization ✅
- [x] Created `MicrophoneStatus` component ✅
  - Shows recording/stopped state ✅
  - Displays permission status ✅
  - Error messages ✅
- [x] Added to operator dashboard (WebSocketTest component) ✅

#### 2.3.5 Integration with WebSocket
- [x] Start audio capture when session starts ✅
- [x] Stop audio capture when session ends ✅
- [x] Pause/resume functionality ✅
- [x] Cleanup on component unmount ✅

**Estimated Time:** 4-6 hours  
**Dependencies:** Phase 2.1 (WebSocket Protocol) ✅  
**Blockers:** None

---

## 📋 Phase 2.4: AI Transcription Integration (STT Provider)

**Priority:** HIGH - Core AI functionality

### Goals
- Choose and integrate STT provider
- Stream audio to STT service
- Receive real-time transcriptions
- Handle errors and retries

### Tasks

#### 2.4.1 STT Provider Selection
- [ ] Evaluate options:
  - **Google Cloud Speech-to-Text**
    - Pros: High accuracy, streaming API, good latency
    - Cons: Requires GCP account, pricing
  - **ElevenLabs Scribe**
    - Pros: Simple API, good for music/lyrics
    - Cons: Newer service, less proven
- [ ] Make decision based on:
  - Latency requirements (<500ms)
  - Accuracy for music/lyrics
  - Cost
  - Ease of integration
- [ ] Set up provider account and get API keys

#### 2.4.2 Backend STT Integration
- [ ] Install provider SDK (e.g., `@google-cloud/speech`)
- [ ] Create `backend/src/services/stt.ts` service
- [ ] Initialize streaming client
- [ ] Configure audio format matching frontend
- [ ] Handle streaming audio chunks
- [ ] Parse transcription results
- [ ] Extract confidence scores

#### 2.4.3 WebSocket Audio Handler
- [ ] Update `handleAudioData` in `backend/src/websocket/handler.ts`
- [ ] Convert Base64 audio to buffer
- [ ] Forward to STT service
- [ ] Receive transcription results
- [ ] Send `TRANSCRIPT_UPDATE` messages with:
  - `text`: Transcription text
  - `isFinal`: Whether transcription is final
  - `confidence`: Confidence score (0-1)
  - `timing`: Timing metadata

#### 2.4.4 Error Handling & Retry Logic
- [ ] Handle STT service errors
- [ ] Implement exponential backoff retry
- [ ] Fallback to manual override if STT fails
- [ ] Logging for debugging
- [ ] User-friendly error messages

**Estimated Time:** 6-8 hours  
**Dependencies:** Phase 2.3 (Audio Capture)  
**Blockers:** STT provider account setup

---

## 📋 Phase 2.5: Backend Audio Processing Pipeline

**Priority:** MEDIUM - Optimization and refinement

### Goals
- Optimize audio buffer management
- Maintain rolling transcription buffer
- Prepare for fuzzy matching

### Tasks

#### 2.5.1 Audio Buffer Management
- [ ] Implement audio chunk queue
- [ ] Handle out-of-order chunks
- [ ] Buffer management for network jitter
- [ ] Memory cleanup

#### 2.5.2 Rolling Transcription Buffer
- [ ] Maintain last 5 seconds of transcription
- [ ] Update buffer with new transcriptions
- [ ] Handle final vs. interim transcriptions
- [ ] Prepare buffer for matching algorithm

#### 2.5.3 Logging & Monitoring
- [ ] Add structured logging
- [ ] Track transcription latency
- [ ] Monitor STT service health
- [ ] Alert on high error rates

**Estimated Time:** 2-3 hours  
**Dependencies:** Phase 2.4 (STT Integration)  
**Blockers:** None

---

## 📋 Phase 3: Predictive Matching Algorithm

**Priority:** HIGH - Core value proposition

### Goals
- Match transcribed text to song lyrics
- Auto-advance slides when match found
- Handle edge cases and errors

### Tasks

#### 3.1 Content Loading (Already Partially Done)
- [x] Cache setlist in memory ✅
- [x] Cache setlist in browser ✅
- [ ] Fetch from Supabase (Phase 1.2)
- [ ] Parse lyrics into lines
- [ ] Handle updates during session

#### 3.2 Fuzzy Matching Engine
- [ ] Install `string-similarity` (already in package.json)
- [ ] Create `backend/src/services/matcher.ts`
- [ ] Implement matching algorithm:
  - Compare rolling buffer to current song lines
  - Use similarity threshold: 0.85
  - Handle partial matches
- [ ] Performance optimization:
  - Only match against current song
  - Cache similarity calculations
  - Early exit on high confidence matches
- [ ] Match confidence scoring

#### 3.3 Slide Management Logic
- [x] Track current slide index ✅
- [ ] Detect match for current line
- [ ] Auto-advance to next slide on match
- [ ] Detect last line match → advance to next song
- [ ] Handle manual overrides (already done ✅)
- [ ] Queue management for smooth transitions

**Estimated Time:** 6-8 hours  
**Dependencies:** Phase 1.2 (Supabase), Phase 2.4 (STT)  
**Blockers:** STT integration needed for real transcriptions

---

## 🎯 Recommended Implementation Order

### Sprint 1: Data Foundation (Week 1)
1. **Supabase Integration** (Phase 1.2)
   - Set up project and schema
   - Replace mock data
   - Test with real events/songs

**Deliverable:** Real data flowing through system

---

### Sprint 2: Audio Input (Week 1-2)
2. **Audio Capture** (Phase 2.3)
   - Browser microphone access
   - Audio streaming to WebSocket
   - Visual feedback components

**Deliverable:** Audio streaming from browser to backend

---

### Sprint 3: AI Processing (Week 2)
3. **STT Integration** (Phase 2.4)
   - Choose provider
   - Integrate streaming STT
   - Real-time transcription

**Deliverable:** Live transcription working

---

### Sprint 4: Matching Engine (Week 2-3)
4. **Fuzzy Matching** (Phase 3.2)
   - Implement matching algorithm
   - Auto-advance logic
   - Performance optimization

**Deliverable:** End-to-end: Audio → Transcription → Match → Slide Change

---

## 📊 Success Metrics

### Phase 1.2 (Supabase)
- ✅ Can create events and songs in Supabase
- ✅ Backend fetches real data on START_SESSION
- ✅ Frontend displays real event/song data

### Phase 2.3 (Audio Capture)
- ✅ Microphone permission granted
- ✅ Audio chunks streaming to backend
- ✅ Visual feedback working
- ✅ Latency: <100ms from capture to send

### Phase 2.4 (STT)
- ✅ Transcriptions arriving in real-time
- ✅ Confidence scores included
- ✅ Latency: <300ms from audio to transcription
- ✅ Error rate: <5%

### Phase 3 (Matching)
- ✅ Matches detected with >85% similarity
- ✅ Slides auto-advance correctly
- ✅ Total latency: <500ms end-to-end
- ✅ Accuracy: >90% correct matches

---

## 🚨 Risks & Mitigations

### Risk 1: STT Provider Latency Too High
- **Mitigation:** Test both Google and ElevenLabs, choose faster one
- **Fallback:** Manual override always available

### Risk 2: Browser Audio Permissions
- **Mitigation:** Clear UI for permission requests, handle gracefully
- **Fallback:** Manual override

### Risk 3: Matching Accuracy
- **Mitigation:** Tune similarity threshold, test with real lyrics
- **Fallback:** Operator can manually correct

### Risk 4: Network Issues During Live Event
- **Mitigation:** Already implemented (RTT monitoring, slide caching)
- **Fallback:** Offline mode with cached slides

---

## 📝 Notes

- **Start with Supabase** - Real data is needed for meaningful testing
- **Audio capture can be tested independently** - Use mock STT initially
- **STT integration is critical path** - Blocks matching algorithm testing
- **Matching algorithm can be tested with mock transcriptions** - Don't wait for STT

---

## 🎯 Immediate Next Steps

1. **Today:** Set up Supabase project and run migrations
2. **This Week:** Complete Supabase integration and audio capture
3. **Next Week:** Integrate STT provider and build matching engine

**Ready to start?** Begin with Phase 1.2 (Supabase Integration)!

