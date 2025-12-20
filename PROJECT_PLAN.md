# ParLeap - Comprehensive Project Plan

## 🎯 Project Overview

ParLeap is a real-time, AI-powered presentation orchestration platform that automates content display (lyrics, captions, sermon notes) at live events by listening to speakers/singers and synchronizing visual output instantly.

**Core Value Proposition:** Eliminate manual slide switching with a predictive AI layer that matches live audio to pre-loaded content.

---

## 📅 Recent Updates (December 2025)

### Security & Infrastructure Updates
- ✅ **Security Patches Applied**: Updated Next.js to 14.2.35 and React to 18.3.1 to patch CVE-2025-55184 (DoS) and CVE-2025-55183 (Source Code Exposure)
- ✅ **Backend CORS Configuration**: Added CORS middleware to backend for Vercel frontend integration
- ✅ **Railway Backend Deployment**: Successfully deployed to Railway (parleapbackend-production.up.railway.app)
  - Connected to GitHub with auto-deploy
  - Environment variables configured
  - Health check and root endpoints verified
- ✅ **Version Alignment**: Fixed eslint-config-next version mismatch (now aligned with Next.js 14.2.34+)
- ✅ **WebSocket Connection Setup**: Frontend WebSocket client, React hook, and test component implemented
  - Vercel environment variable `NEXT_PUBLIC_WS_URL` configured
  - Frontend redeployed and ready for Phase 2 implementation
- ✅ **WebSocket Protocol Implementation**: Complete typed message protocol implemented
  - TypeScript interfaces for all message types
  - Zod validation schemas
  - Backend message handlers (START_SESSION, MANUAL_OVERRIDE, STOP_SESSION, PING)
  - Session state management with change detection
  - Frontend typed client with helper methods
  - Message history tracking in test component
  - Protocol tested and verified
- ✅ **Latency Attack Features**: Comprehensive latency monitoring and resilience features implemented
  - **Latenc-o-meter**: Dev tool for measuring pipeline latency at every stage
  - **Ghost Text**: Real-time transcription display for operator trust building
  - **RTT Monitoring**: Continuous connection quality monitoring with degraded mode detection
  - **Slide Caching**: Local browser caching and preloading of next 3 slides
  - **Timing Metadata**: All server responses include timing data for latency measurement
  - **Weak Signal Badge**: Visual indicator when network RTT exceeds 500ms threshold
- ✅ **Production Deployment & Testing**: All features deployed and tested successfully (Dec 2025)
  - ✅ TypeScript errors fixed (unused variables)
  - ✅ Vercel frontend deployment successful
  - ✅ Railway backend deployment successful
  - ✅ WebSocket connection verified in production
  - ✅ All latency features tested and working
- ✅ **Phase 1.2: Supabase Integration** (Dec 14, 2025)
  - ✅ Event service for Supabase queries
  - ✅ Real data fetching in WebSocket handler
  - ✅ Database seed script for test data
  - ✅ Comprehensive documentation (7 guides)
- ✅ **Phase 2.3: Audio Capture** (Dec 14, 2025)
  - ✅ useAudioCapture hook with MediaRecorder API
  - ✅ Audio streaming to WebSocket (AUDIO_DATA messages)
  - ✅ AudioLevelMeter and MicrophoneStatus components
  - ✅ Auto-start/stop with session lifecycle
  - ✅ Permission handling and error recovery
  - ✅ Real-time audio level visualization

---

## 📋 Implementation Phases

### **Phase 1: Foundation & Infrastructure** ✅ (Current)

#### 1.1 Monorepo Setup ✅
- [x] Root workspace configuration
- [x] Frontend (Next.js 14) structure
- [x] Backend (Express/TypeScript) structure
- [x] TypeScript strict mode configuration
- [x] ESLint setup

#### 1.2 Supabase Integration (Next)
- [ ] Create Supabase project
- [ ] Initialize Supabase client in frontend
- [ ] Initialize Supabase client in backend
- [ ] Database schema migration:
  - [ ] `profiles` table
  - [ ] `songs` table
  - [ ] `events` table
  - [ ] `event_items` table
- [ ] Row Level Security (RLS) policies
- [ ] Authentication setup (Supabase Auth)

#### 1.3 Frontend Foundation
- [ ] Install Shadcn/UI components
- [ ] Create base layout with dark mode
- [ ] Set up Zustand stores structure
- [ ] Create routing structure:
  - [ ] `/` - Landing/Dashboard
  - [ ] `/auth` - Authentication pages
  - [ ] `/songs` - Content library
  - [ ] `/events` - Event management
  - [ ] `/live/[eventId]` - Live presentation view
  - [ ] `/operator/[eventId]` - Operator dashboard

#### 1.4 Backend Foundation
- [x] Express server setup with TypeScript
- [x] WebSocket server initialization (`ws` library)
- [x] Environment variable configuration
- [x] CORS middleware configuration
- [ ] Error handling middleware
- [ ] Logging setup
- [x] Health check endpoints

---

### **Phase 2: Real-Time Engine**

#### 2.1 WebSocket Protocol Implementation ✅
- [x] Define TypeScript interfaces for WebSocket messages
- [x] Client-to-Server message handlers:
  - [x] `START_SESSION` - Initialize event session
  - [x] `AUDIO_DATA` - Stream audio chunks (handler ready, needs STT integration)
  - [x] `MANUAL_OVERRIDE` - Manual slide control
  - [x] `STOP_SESSION` - End session
  - [x] `PING` - Keep-alive
- [x] Server-to-Client message handlers:
  - [x] `SESSION_STARTED` - Session confirmation
  - [x] `TRANSCRIPT_UPDATE` - Real-time transcription (handler ready, needs STT integration)
  - [x] `DISPLAY_UPDATE` - Slide change notifications
  - [x] `SONG_CHANGED` - Song change notification
  - [x] `SESSION_ENDED` - Session ended
  - [x] `ERROR` - Error notification
  - [x] `PONG` - Keep-alive response
- [x] Connection management (handle disconnects, reconnects)
- [x] Message validation with Zod schemas
- [x] Session state management
- [x] Frontend WebSocket client with typed messages
- [x] React hook for WebSocket integration
- [x] Test component for protocol verification

#### 2.3 Audio Capture (Frontend) ✅
- [x] Browser microphone access (`MediaRecorder` API) ✅
- [x] Audio chunk streaming to WebSocket ✅
- [x] Audio format configuration (16kHz, mono, WebM Opus) ✅
- [x] Error handling for microphone permissions ✅
- [x] Visual feedback for audio capture status ✅
- [x] Audio level visualization ✅

#### 2.4 AI Transcription Integration
- [ ] Choose STT provider (Google Cloud Speech-to-Text OR ElevenLabs Scribe)
- [ ] Set up API credentials and configuration
- [ ] Streaming transcription implementation
- [ ] Audio format conversion for STT provider
- [ ] Error handling and retry logic
- [ ] Transcription buffer management

#### 2.5 Backend Audio Processing Pipeline
- [ ] WebSocket audio chunk receiver
- [ ] Audio buffer management
- [ ] Forward audio to STT provider
- [ ] Receive and parse transcription results
- [ ] Maintain rolling buffer (last 5 seconds)
- [ ] Logging and monitoring

---

### **Phase 3: Predictive Matching Algorithm**

#### 3.1 Content Loading & Caching
- [ ] On `START_SESSION`, fetch event items from Supabase
- [ ] Load song lyrics and parse into lines
- [ ] Cache setlist in memory (Node.js)
- [ ] Handle setlist updates during live session
- [ ] Error handling for missing content

#### 3.2 Fuzzy Matching Engine
- [ ] Implement string similarity algorithm (`string-similarity`)
- [ ] Compare rolling buffer against current song lines
- [ ] Similarity threshold: 0.85
- [ ] Handle partial matches and edge cases
- [ ] Performance optimization (sub-500ms goal)
- [ ] Match confidence scoring

#### 3.3 Slide Management Logic
- [ ] Track current slide index
- [ ] Detect when last line of song is matched
- [ ] Auto-advance to next song in setlist
- [ ] Handle manual overrides
- [ ] Queue management for smooth transitions
- [ ] State persistence across reconnects

#### 3.4 Dual Screen Logic
- [ ] Operator Dashboard (control view)
- [ ] Audience/Projector View (display view)
- [ ] Separate WebSocket channels or message routing
- [ ] Synchronization between views
- [ ] Preview mode for operator

---

### **Phase 4: Frontend Features**

#### 4.1 Authentication & User Management
- [ ] Supabase Auth integration
- [ ] Login/Signup pages
- [ ] Protected routes
- [ ] User profile management
- [ ] Subscription tier handling

#### 4.2 Content Library (Songs)
- [ ] CRUD operations for songs
- [ ] Lyrics editor with line parsing
- [ ] Bulk import functionality
- [ ] Search and filter
- [ ] Tag/category system

#### 4.3 Event Management
- [ ] Create/edit events
- [ ] Setlist builder (drag-and-drop)
- [ ] Event status management (draft/live/ended)
- [ ] Event scheduling
- [ ] Duplicate event functionality

#### 4.4 Live Presentation Views
- [x] Operator Dashboard (Partial):
  - [x] Real-time transcription display (Ghost Text component) ✅
  - [x] Connection status with RTT monitoring ✅
  - [x] Weak Signal badge for degraded connections ✅
  - [ ] Current slide preview
  - [x] Manual controls (next/previous) ✅
  - [ ] Audio level meter
- [ ] Audience View:
  - [ ] Full-screen slide display
  - [ ] Smooth transitions
  - [ ] Glassmorphism styling
  - [ ] Responsive design

#### 4.5 State Management (Zustand)
- [x] Auth store ✅
- [ ] Songs store
- [ ] Events store
- [ ] Live session store
- [x] WebSocket connection store ✅ (via useWebSocket hook)
- [x] Slide cache store ✅ (`slideCache` for local caching and preloading)

---

### **Phase 5: Testing & Optimization**

#### 5.1 Testing Strategy
- [ ] Unit tests for fuzzy matching algorithm
- [ ] Integration tests for WebSocket protocol
- [ ] E2E tests for critical user flows
- [ ] Simulate Service workflow (dummy audio injection)
- [ ] Load testing (50 concurrent connections)

#### 5.2 Performance Optimization
- [ ] Latency profiling (< 500ms end-to-end)
- [ ] WebSocket message optimization
- [ ] Database query optimization
- [ ] Frontend bundle size optimization
- [ ] Caching strategies

#### 5.3 Error Handling & Resilience
- [x] Graceful degradation ✅ (RTT monitoring, degraded mode detection, slide caching)
- [x] Connection retry logic ✅ (Exponential backoff in WebSocket client)
- [x] Weak Signal detection ✅ (RTT > 500ms triggers visual warning)
- [x] Slide preloading for offline resilience ✅
- [ ] Error boundaries (React)
- [ ] User-friendly error messages
- [ ] Logging and monitoring

---

### **Phase 6: Production Readiness**

#### 6.1 Security
- [ ] RLS policies review
- [ ] API rate limiting
- [ ] Input validation
- [ ] CORS configuration
- [ ] Environment variable security

#### 6.2 Deployment
- [x] Frontend deployment (Vercel) ✅ - Live at [par-leap.vercel.app](https://par-leap.vercel.app)
- [ ] Backend deployment (Railway) ⏭️ - Next Step
- [x] Frontend environment configuration ✅
- [ ] Backend environment configuration
- [ ] Database migrations
- [x] CI/CD pipeline (GitHub Actions) ✅

#### 6.3 Documentation
- [ ] API documentation
- [ ] WebSocket protocol documentation
- [ ] User guide
- [ ] Developer setup guide
- [ ] Architecture diagrams

---

## 🏗️ Technical Architecture

### Data Flow
```
Browser Mic → Frontend (MediaRecorder) 
  → WebSocket → Backend (Express/ws)
    → STT Provider (Google/ElevenLabs)
      → Transcription → Fuzzy Matching
        → Supabase (Setlist Cache)
          → Match Found → WebSocket
            → Frontend (Display Update)
```

### Key Components

**Frontend:**
- Next.js 14 App Router
- Zustand (State)
- WebSocket Client
- MediaRecorder API
- Shadcn/UI Components

**Backend:**
- Express.js Server
- WebSocket Server (`ws`)
- STT Integration
- Fuzzy Matching Engine
- Supabase Client

**Infrastructure:**
- Supabase (Auth, DB, Storage)
- STT Provider (Google/ElevenLabs)

---

## 📊 Success Metrics

- **Latency:** < 500ms end-to-end (audio → display)
- **Accuracy:** > 85% match confidence
- **Reliability:** Handle 50+ concurrent connections
- **Uptime:** 99.9% availability

---

## 🚀 Next Steps (Immediate)

1. **Fix npm dev script** ✅ (Using npm-run-all)
2. **Install dependencies:** `npm install`
3. **Set up Supabase project**
4. **Create database schema**
5. **Initialize Supabase clients**

---

## 📝 Notes

- Use strict TypeScript (no `any`)
- Optimize for sub-500ms latency
- Dark mode + Glassmorphism UI
- Always implement RLS policies
- Test with simulated audio before live events

---

**Last Updated:** December 13, 2025
**Status:** Phase 2.1 & 2.2 Complete - Latency Attack Features Implemented ✅  
**Production Status:** All features deployed and tested successfully ✅

## 🎯 Latency Attack Summary

**Completed Features:**
1. **Latenc-o-meter**: Dev tool measuring latency at every pipeline stage
2. **Ghost Text**: Real-time transcription display for operator trust
3. **RTT Monitoring**: Continuous connection quality monitoring with degraded mode detection
4. **Slide Caching**: Local browser caching and preloading for resilience

**Key Metrics:**
- All server responses include timing metadata
- RTT monitored continuously (5-second intervals)
- Next 3 slides always preloaded locally
- Weak Signal badge appears at RTT > 500ms

**Next Steps:**
1. **Phase 1.2:** Supabase Integration (Foundation)
   - Set up Supabase project and database schema
   - Replace mock data with real queries
   - Initialize Supabase clients
2. **Phase 2.3:** Audio Capture (Frontend)
   - Browser microphone access
   - Audio streaming to WebSocket
   - Visual feedback components
3. **Phase 2.4:** STT Integration (AI Processing)
   - Choose STT provider (Google/ElevenLabs)
   - Integrate streaming transcription
   - Real-time transcription pipeline
4. **Phase 3:** Fuzzy Matching Algorithm
   - Implement string similarity matching
   - Auto-advance slide logic
   - Performance optimization

**See [NEXT_PHASE_PLAN.md](./NEXT_PHASE_PLAN.md) for detailed implementation plan.**

