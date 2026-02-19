# Railway Deployment Fixes

---

## Railway Backend Build Fix (February 19, 2026)

### Problem
Backend build on Railway was failing with one or more of:
- `tsc: not found` (exit 127) — PATH in Nixpacks build shell doesn’t include `node_modules/.bin`
- `npx tsc` / `npx -p typescript tsc` — ran the wrong package (joke “tsc” package) or a separate TypeScript that didn’t see project `node_modules`, causing TS7016 (missing declarations) and TS7006 (implicit any)
- `node ../node_modules/typescript/bin/tsc` — `MODULE_NOT_FOUND`: Railway runs `npm ci` with production semantics, so **devDependencies** (including `typescript` and `@types/*`) were not installed

### Solution applied

1. **Use the project’s TypeScript binary**
   - In `backend/package.json`, build and type-check scripts call the compiler explicitly:
   - `"build": "node ../node_modules/typescript/bin/tsc"`
   - `"type-check": "node ../node_modules/typescript/bin/tsc --noEmit"`
   - This uses the repo’s TypeScript and `tsconfig`; no reliance on PATH or npx.

2. **Install TypeScript and @types in production**
   - Railway’s `npm ci` does not install devDependencies. So:
   - **typescript** — moved from devDependencies to **dependencies** (so it’s present at build time)
   - **@types/express**, **@types/cors**, **@types/string-similarity** — moved from devDependencies to **dependencies** (so `tsc` sees declaration files and TS7016 goes away)

3. **Type Express route handlers**
   - In `backend/src/index.ts`, added `import type { Request, Response, NextFunction } from 'express'` and typed every middleware and route handler with `(req: Request, res: Response, next: NextFunction)` or `(req: Request, res: Response)` so strict mode passes (TS7006 resolved).

### Result
- Backend builds successfully on Railway.
- No `tsc`/PATH issues, no wrong-TypeScript or missing-@types issues.
- CI and local `npm run build --workspace=@parleap/backend` and `npm run type-check --workspace=@parleap/backend` all pass.

### Commits (representative)
- `89dc949` — fix(backend): move typescript to dependencies for Railway build
- `45b2f93` — fix(backend): TS build for Railway - @types in deps, typed Express handlers
- `84f4139` — fix(backend): use project TypeScript binary for Railway build

### Don’t revert to
- Plain `tsc` in scripts (fails: not on PATH in Nixpacks)
- `npx tsc` (resolves to wrong npm package)
- `npx -p typescript tsc` (can install a separate TypeScript that doesn’t see project node_modules)

---

## Railway Frontend Deployment Fix

### 🔴 Problem
Frontend deployment is crashing because Railway is trying to build/run the backend as part of the frontend service.

## ✅ Solution Applied

### 1. Created Frontend-Specific Railway Config
**File:** `frontend/railway.toml`
- Explicitly tells Railway to only build/run frontend
- Uses workspace commands to isolate frontend

### 2. Created Railway Ignore File
**File:** `.railwayignore`
- Tells Railway to ignore backend folder for frontend service

### 3. Created Nixpacks Config
**File:** `frontend/nixpacks.toml`
- Explicit build/start commands for frontend only

## 🚀 Next Steps

### Option 1: Update Railway Service Settings (Recommended)

1. Go to Railway Dashboard → Your Frontend Service
2. Go to **Settings** → **Build & Deploy**
3. Set **Root Directory** to: `frontend`
4. Set **Build Command** to: `npm install && npm run build`
5. Set **Start Command** to: `npm start`
6. **Save** and redeploy

### Option 2: Use Railway Service Detection

1. Delete the root `railway.json` (or move it to `backend/`)
2. Railway will auto-detect Next.js in `frontend/` folder
3. It should automatically configure correctly

### Option 3: Separate Repositories (Future)

Consider splitting frontend and backend into separate repos for cleaner deployments.

## 🔍 Root Cause

Railway detected the monorepo structure and tried to build everything. The root `railway.json` was configured for backend, but Railway applied it to both services.

## ✅ Verification

After fixing, the frontend should:
- ✅ Build only frontend code
- ✅ Not try to execute backend code
- ✅ Start with `npm start` in frontend directory
- ✅ Deploy successfully

## 📝 Environment Variables Needed

Make sure these are set in Railway for the frontend service:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_WS_URL` (your backend WebSocket URL)

