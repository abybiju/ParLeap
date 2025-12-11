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

## Project Status

Phase 1: Skeleton Setup ✅

