# ParLeap

Real-time AI-powered presentation orchestration platform.

## 🟢 Current Status

**Last Updated:** January 25, 2026

### Live Deployments
- **Frontend**: [www.parleap.com](https://www.parleap.com) (Vercel)
- **Backend**: [parleapbackend-production.up.railway.app](https://parleapbackend-production.up.railway.app) (Railway)
- **Dashboard**: [/dashboard](https://www.parleap.com/dashboard)
- **Songs Library**: [/songs](https://www.parleap.com/songs)
- **Operator View**: [/live/[eventId]](https://www.parleap.com/live/[eventId])
- **Projector View**: [/projector/[eventId]](https://www.parleap.com/projector/[eventId])
- **Test Page**: [/test-websocket](https://www.parleap.com/test-websocket)

### What's Working Now
- ✅ **Real-time STT**: ElevenLabs streaming transcription operational
- ✅ **Audio Capture**: PCM audio streaming from browser microphone
- ✅ **Fuzzy Matching**: Production-ready matching engine with auto-advance
- ✅ **WebSocket Protocol**: Full bidirectional communication
- ✅ **Custom Domain**: www.parleap.com with SSL certificates
- ✅ **Operator Console**: Complete dashboard, operator HUD, and projector view
- ✅ **Real-time Sync**: Operator and projector views synchronized
- ✅ **Cross-device**: Works on any computer, tablet, or phone
- ✅ **Supabase Database**: Real data integration (no more mock fallback)
- ✅ **Songs Library**: Notion-style CRUD interface with stanza-aware editor

### Recent Updates

**January 25, 2026**
- ✅ **Songs Library**: Complete Notion-style song management interface
  - DataTable with fuzzy search and sorting
  - Split-view editor (raw input | live preview)
  - Stanza-aware parsing with glassmorphism preview cards
  - localStorage draft auto-save with recovery
  - Full CRUD operations (create, update, delete)
  - CCLI number support (optional)
  - Line count badges
  - Toast notifications
- 🔧 **UX Fixes**: Improved stanza parser for Windows/Mac line endings
- ✅ **Home Page**: Added navigation buttons for quick access

**January 21, 2026**
- ✅ **Operator Console Sprint**: Complete production-ready interface
  - Event selector dashboard with card grid
  - Three-panel operator HUD (Ghost Text | Slide Display | Setlist)
  - Full-screen projector view for audience
- 🔧 **WebSocket Stability**: Fixed intermittent connection issues
  - Changed to manual connect pattern (matching test page)
  - Added connection stabilization delay
  - Stable connections, no more "CONNECTING" loops
- 🔧 **Broadcast Synchronization**: Fixed projector view updates
  - Added broadcastToEvent() helper function
  - Manual overrides and AI auto-advances now broadcast to all clients
  - Perfect real-time synchronization between views

### Quick Status Check
For complete project status, see **[PROJECT_STATUS_COMPLETE.md](./PROJECT_STATUS_COMPLETE.md)**

---

## Monorepo Structure

```
ParLeap/
├── frontend/          # Next.js 14 App Router application
├── backend/          # Node.js/Express WebSocket server
└── package.json      # Root workspace configuration
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
npm install
```

### Development

Run both frontend and backend:
```bash
npm run dev
```

Run frontend only:
```bash
npm run dev:frontend
```

Run backend only:
```bash
npm run dev:backend
```

### Build

```bash
npm run build
```

## Technology Stack

### Frontend
- Next.js 14.2.35 (App Router) - Patched for CVE-2025-55184, CVE-2025-55183
- React 18.3.1
- TypeScript (Strict mode)
- Tailwind CSS + Shadcn/UI
- Zustand (State Management)
- Lucide React (Icons)

### Backend
- Node.js + Express.js
- TypeScript
- WebSocket (ws library)
- CORS middleware configured
- Zod (Validation)
- string-similarity (Fuzzy Matching)

## Deployment

For complete deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

### Quick Deploy

1. ✅ **GitHub**: Repository connected and code pushed (auto-deploy enabled)
2. ✅ **Vercel (Frontend)**: Successfully deployed at [www.parleap.com](https://www.parleap.com)
   - Root directory: `frontend`
   - Framework: Next.js (auto-detected)
   - Environment variables configured
   - Security patches applied (Next.js 14.2.35, React 18.3.1)
   - Custom domain configured with SSL
3. ✅ **Railway (Backend)**: Successfully deployed at [parleapbackend-production.up.railway.app](https://parleapbackend-production.up.railway.app)
   - Root directory: `backend`
   - Node.js 20 runtime
   - CORS middleware configured
   - Health check endpoint (`/health`)
   - Environment variables configured
4. ✅ **Supabase**: Real database integration (migrations complete, data seeded)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed step-by-step instructions.

## Documentation

- **[PROJECT_STATUS_COMPLETE.md](./PROJECT_STATUS_COMPLETE.md)** - **📊 Master status file** - Complete project status and features
- [PROJECT_PLAN.md](./PROJECT_PLAN.md) - Detailed project roadmap and phase tracking
- [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) - **Start here!** Step-by-step production setup checklist
- [TECH_STACK.md](./TECH_STACK.md) - **Technology stack documentation** - Why we chose each technology
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) - Latest deployment status and session summary
- [RAILWAY_SETUP.md](./RAILWAY_SETUP.md) - **Railway backend deployment guide** (Quick reference)
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [ENV_SETUP.md](./ENV_SETUP.md) - Environment variables setup
- [QUICK_START.md](./QUICK_START.md) - Quick start guide
- [NEXT_PHASE_PLAN.md](./NEXT_PHASE_PLAN.md) - **Next phase implementation plan** (Current focus)
- [PRODUCTION_TESTING.md](./PRODUCTION_TESTING.md) - Production testing guide
- [supabase/README.md](./supabase/README.md) - Supabase setup guide

## Project Status

### Phase 1: Foundation & Infrastructure ✅ Complete

- ✅ Monorepo Setup
- ✅ Frontend Foundation (Next.js 14.2.35)
- ✅ Backend Foundation (Express/TypeScript)
- ✅ **Security Updates** (Dec 2025)
  - ✅ Next.js updated to 14.2.35 (patched CVE-2025-55184, CVE-2025-55183)
  - ✅ React updated to 18.3.1
  - ✅ eslint-config-next aligned with Next.js version
- ✅ GitHub Repository Setup
- ✅ **Vercel Frontend Deployment** ✅ (Live at [par-leap.vercel.app](https://par-leap.vercel.app))
- ✅ **Railway Backend Deployment** ✅ (Live at [parleapbackend-production.up.railway.app](https://parleapbackend-production.up.railway.app))
  - ✅ Connected to GitHub (auto-deploy enabled)
  - ✅ CORS middleware configured
  - ✅ Health check endpoint (`/health`)
  - ✅ Root endpoint (`/`) for API info
  - ✅ Environment variables configured
- ✅ **WebSocket Connection Setup** ✅
  - ✅ WebSocket client utility and React hook implemented
  - ✅ Vercel environment variable `NEXT_PUBLIC_WS_URL` configured
  - ✅ Frontend redeployed and ready for testing
- ✅ **WebSocket Protocol Implementation** ✅
  - ✅ Typed message protocol (TypeScript interfaces)
  - ✅ Zod validation schemas
  - ✅ Backend handlers (START_SESSION, MANUAL_OVERRIDE, STOP_SESSION, PING)
  - ✅ Session state management
  - ✅ Frontend typed client with helper methods
  - ✅ Protocol tested and verified
- ✅ **Latency Attack Features** ✅ (Dec 2025)
  - ✅ **Latenc-o-meter**: Dev tool for measuring pipeline latency at every stage
  - ✅ **Ghost Text**: Real-time transcription display for operator trust building
  - ✅ **RTT Monitoring**: Continuous connection quality monitoring with degraded mode detection
  - ✅ **Slide Caching**: Local browser caching and preloading of next 3 slides
  - ✅ **Timing Metadata**: All server responses include timing data for latency measurement
  - ✅ **Weak Signal Badge**: Visual indicator when network RTT exceeds 500ms threshold
- ✅ **Production Deployment** ✅ (Dec 2025 - Jan 2026)
  - ✅ All features deployed to Vercel and Railway
  - ✅ Production testing completed successfully
  - ✅ TypeScript build errors resolved
  - ✅ WebSocket connection verified in production
  - ✅ Custom domain configured (www.parleap.com)
  - ✅ Node.js 20 upgrade complete

### Phase 2: Real-Time Engine ✅ Complete
- ✅ **2.1 WebSocket Protocol** ✅
- ✅ **2.3 Audio Capture** ✅
- ✅ **2.4 STT Integration** ✅ (ElevenLabs realtime)
- ✅ **2.5 Audio Processing Pipeline** ✅

### Phase 3: Predictive Matching Algorithm ✅ Complete
- ✅ **3.1 Content Loading & Caching** ✅
- ✅ **3.2 Fuzzy Matching Engine** ✅ (Production-ready)
- ✅ **3.3 Slide Management Logic** ✅
- ✅ **3.4 Frontend Display Components** ✅

### Phase 4: Frontend Features ⏭️ In Progress
- ✅ **4.1 Authentication** ✅ (Partial)
- ✅ **4.2 Content Library** ✅ (Songs Library Complete)
- ⏭️ **4.3 Event Management** (Pending)
- ✅ **4.4 Live Presentation Views** ✅ (Partial - Operator Dashboard)
- ✅ **4.5 State Management** ✅ (Partial)

**See [PROJECT_STATUS_COMPLETE.md](./PROJECT_STATUS_COMPLETE.md) for complete status.**

