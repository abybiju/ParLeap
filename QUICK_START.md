# ParLeap - Quick Start Guide

## 🚀 Getting Started

### Prerequisites Check
```bash
node --version  # Should be >= 18.0.0
npm --version   # Should be >= 9.0.0
```

### Installation

1. **Install all dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create `.env.local` in `frontend/`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   
   Create `.env` in `backend/`:
   ```env
   PORT=3001
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   STT_PROVIDER=google  # or "elevenlabs"
   GOOGLE_CLOUD_API_KEY=your_google_api_key  # if using Google
   ELEVENLABS_API_KEY=your_elevenlabs_key  # if using ElevenLabs
   ```

### Development

**Run both frontend and backend:**
```bash
npm run dev
```

**Run separately:**
```bash
# Frontend only (port 3000)
npm run dev:frontend

# Backend only (port 3001)
npm run dev:backend
```

### Common Issues

**Issue: `npm: command not found`**
- Solution: Install Node.js from [nodejs.org](https://nodejs.org/) or use a version manager like `nvm`

**Issue: Port already in use**
- Solution: Kill the process using the port or change the port in config

**Issue: Workspace dependencies not found**
- Solution: Run `npm install` from the root directory

---

## 📁 Project Structure

```
ParLeap/
├── frontend/          # Next.js 14 App Router
│   ├── app/          # App Router pages
│   ├── components/   # React components
│   └── lib/          # Utilities
├── backend/          # Express + WebSocket server
│   └── src/         # Backend source code
└── package.json      # Root workspace config
```

---

## 🎯 Next Steps

1. ✅ Monorepo setup complete
2. ⏭️ Set up Supabase project
3. ⏭️ Create database schema
4. ⏭️ Implement authentication
5. ⏭️ Build WebSocket protocol

See `PROJECT_PLAN.md` for detailed roadmap.

