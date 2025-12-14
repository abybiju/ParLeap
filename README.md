# ParLeap

Real-time AI-powered presentation orchestration platform.

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

1. ✅ **GitHub**: Repository connected and code pushed
2. ✅ **Vercel (Frontend)**: Successfully deployed at [par-leap.vercel.app](https://par-leap.vercel.app)
   - Root directory: `frontend`
   - Framework: Next.js (auto-detected)
   - Environment variables configured
   - Security patches applied (Next.js 14.2.35, React 18.3.1)
3. ✅ **Railway (Backend)**: Successfully deployed at [parleapbackend-production.up.railway.app](https://parleapbackend-production.up.railway.app)
   - Root directory: `backend`
   - CORS middleware configured
   - Health check endpoint (`/health`)
   - Root endpoint (`/`) returns API info
   - Environment variables configured
4. ⏭️ **Supabase**: Create project and run migration from `supabase/migrations/001_initial_schema.sql`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed step-by-step instructions.

## Documentation

- [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) - **Start here!** Step-by-step production setup checklist
- [TECH_STACK.md](./TECH_STACK.md) - **Technology stack documentation** - Why we chose each technology
- [RAILWAY_SETUP.md](./RAILWAY_SETUP.md) - **Railway backend deployment guide** (Quick reference)
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [ENV_SETUP.md](./ENV_SETUP.md) - Environment variables setup
- [QUICK_START.md](./QUICK_START.md) - Quick start guide
- [PROJECT_PLAN.md](./PROJECT_PLAN.md) - Detailed project roadmap
- [NEXT_PHASE_PLAN.md](./NEXT_PHASE_PLAN.md) - **Next phase implementation plan** (Current focus)
- [PRODUCTION_TESTING.md](./PRODUCTION_TESTING.md) - Production testing guide
- [supabase/README.md](./supabase/README.md) - Supabase setup guide

## Project Status

### Phase 1: Foundation & Infrastructure ✅ (In Progress)

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
- ✅ **Production Deployment** ✅ (Dec 2025)
  - ✅ All features deployed to Vercel and Railway
  - ✅ Production testing completed successfully
  - ✅ TypeScript build errors resolved
  - ✅ WebSocket connection verified in production
- ⏭️ **Next Phase**: Supabase Integration → Audio Capture → STT Integration

