# ParLeap - Comprehensive Project Plan

## 🎯 Project Overview

ParLeap is a real-time, AI-powered presentation orchestration platform that automates content display (lyrics, captions, sermon notes) at live events by listening to speakers/singers and synchronizing visual output instantly.

**Core Value Proposition:** Eliminate manual slide switching with a predictive AI layer that matches live audio to pre-loaded content.

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
- [ ] Express server setup with TypeScript
- [ ] WebSocket server initialization (`ws` library)
- [ ] Environment variable configuration
- [ ] Error handling middleware
- [ ] Logging setup
- [ ] Health check endpoints

---

### **Phase 2: Real-Time Engine**

#### 2.1 WebSocket Protocol Implementation
- [ ] Define TypeScript interfaces for WebSocket messages
- [ ] Client-to-Server message handlers:
  - [ ] `START_SESSION` - Initialize event session
  - [ ] `AUDIO_DATA` - Stream audio chunks
  - [ ] `MANUAL_OVERRIDE` - Manual slide control
- [ ] Server-to-Client message handlers:
  - [ ] `TRANSCRIPT_UPDATE` - Real-time transcription
  - [ ] `DISPLAY_UPDATE` - Slide change notifications
- [ ] Connection management (handle disconnects, reconnects)
- [ ] Message validation with Zod schemas

#### 2.2 Audio Capture (Frontend)
- [ ] Browser microphone access (`MediaRecorder` API)
- [ ] Audio chunk streaming to WebSocket
- [ ] Audio format configuration (sample rate, channels)
- [ ] Error handling for microphone permissions
- [ ] Visual feedback for audio capture status
- [ ] Audio level visualization

#### 2.3 AI Transcription Integration
- [ ] Choose STT provider (Google Cloud Speech-to-Text OR ElevenLabs Scribe)
- [ ] Set up API credentials and configuration
- [ ] Streaming transcription implementation
- [ ] Audio format conversion for STT provider
- [ ] Error handling and retry logic
- [ ] Transcription buffer management

#### 2.4 Backend Audio Processing Pipeline
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
- [ ] Operator Dashboard:
  - [ ] Real-time transcription display
  - [ ] Current slide preview
  - [ ] Manual controls (next/previous)
  - [ ] Connection status
  - [ ] Audio level meter
- [ ] Audience View:
  - [ ] Full-screen slide display
  - [ ] Smooth transitions
  - [ ] Glassmorphism styling
  - [ ] Responsive design

#### 4.5 State Management (Zustand)
- [ ] Auth store
- [ ] Songs store
- [ ] Events store
- [ ] Live session store
- [ ] WebSocket connection store

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
- [ ] Graceful degradation
- [ ] Connection retry logic
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
- [ ] Frontend deployment (Vercel/Netlify)
- [ ] Backend deployment (Railway/Render/Fly.io)
- [ ] Environment configuration
- [ ] Database migrations
- [ ] CI/CD pipeline

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

**Last Updated:** Initial Plan
**Status:** Phase 1 in progress

