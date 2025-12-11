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
- Next.js 14+ (App Router)
- TypeScript (Strict mode)
- Tailwind CSS + Shadcn/UI
- Zustand (State Management)
- Lucide React (Icons)

### Backend
- Node.js + Express.js
- TypeScript
- WebSocket (ws library)
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
3. ⏭️ **Railway (Backend)**: Connect GitHub repo, set root directory to `backend`, add environment variables
4. ⏭️ **Supabase**: Create project and run migration from `supabase/migrations/001_initial_schema.sql`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed step-by-step instructions.

## Documentation

- [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) - **Start here!** Step-by-step production setup checklist
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [ENV_SETUP.md](./ENV_SETUP.md) - Environment variables setup
- [QUICK_START.md](./QUICK_START.md) - Quick start guide
- [PROJECT_PLAN.md](./PROJECT_PLAN.md) - Detailed project roadmap
- [supabase/README.md](./supabase/README.md) - Supabase setup guide

## Project Status

### Phase 1: Foundation & Infrastructure ✅ (In Progress)

- ✅ Monorepo Setup
- ✅ Frontend Foundation (Next.js 14)
- ✅ Backend Foundation (Express/TypeScript)
- ✅ GitHub Repository Setup
- ✅ **Vercel Frontend Deployment** ✅ (Live at [par-leap.vercel.app](https://par-leap.vercel.app))
- ⏭️ Railway Backend Deployment (Next Step)
- ⏭️ Supabase Integration

