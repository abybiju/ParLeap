# ParLeap Deployment Guide

Complete step-by-step guide for deploying ParLeap to production.

## Prerequisites

- GitHub account and repository created
- Vercel account (for frontend)
- Railway account (for backend)
- Supabase account (for database)

---

## Step 1: Push Code to GitHub

If you haven't already, push your local code to GitHub:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit: ParLeap monorepo setup"

# Add remote (replace with your GitHub repo URL)
git remote add origin https://github.com/YOUR_USERNAME/ParLeap.git

# Push to main branch
git push -u origin main
```

---

## Step 2: Set Up Supabase

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in project details:
   - **Name**: ParLeap
   - **Database Password**: Generate a strong password (save it securely!)
   - **Region**: Choose closest to your users
4. Wait for project to be created (~2 minutes)

### 2.2 Run Database Migration

1. In your Supabase dashboard, go to **SQL Editor**
2. Open `supabase/migrations/001_initial_schema.sql` from your project
3. Copy the entire contents
4. Paste into the SQL Editor
5. Click **"Run"** to execute the migration

### 2.3 Get API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy the following values (you'll need these for environment variables):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (for frontend)
   - **service_role key**: `eyJhbGc...` (for backend - KEEP SECRET!)

### 2.4 Configure Authentication

1. Go to **Authentication** → **Providers**
2. Ensure **Email** provider is enabled (default)
3. Configure redirect URLs:
   - Add your Vercel frontend URL: `https://your-app.vercel.app`
   - Add callback URL: `https://your-app.vercel.app/auth/callback`

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Connect Repository

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository: `ParLeap`
4. Vercel will detect it's a monorepo

### 3.2 Configure Project Settings

**Root Directory:**
- Set to `frontend`

**Build Settings:**
- Framework Preset: `Next.js` (auto-detected)
- Build Command: `cd frontend && npm run build` (already in `vercel.json`)
- Output Directory: `frontend/.next` (already in `vercel.json`)
- Install Command: `npm install` (already in `vercel.json`)

### 3.3 Add Environment Variables

In Vercel project settings → **Environment Variables**, add:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app
```

**Important:** Add these for all environments (Production, Preview, Development).

### 3.4 Deploy

1. Click **"Deploy"**
2. Wait for build to complete
3. Note your deployment URL: `https://your-app.vercel.app`

---

## Step 4: Deploy Backend to Railway

### 4.1 Connect Repository

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `ParLeap` repository

### 4.2 Configure Service

1. Railway will create a new service
2. In service settings, configure:
   - **Root Directory**: `backend`
   - **Build Command**: `cd backend && npm install && npm run build` (already in `railway.json`)
   - **Start Command**: `cd backend && npm start` (already in `railway.json`)

### 4.3 Add Environment Variables

In Railway service → **Variables**, add:

```
PORT=3001
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
CORS_ORIGIN=https://your-frontend.vercel.app
```

**Important:** Replace `your-frontend.vercel.app` with your actual Vercel deployment URL.

### 4.4 Generate Public Domain

1. In Railway service, go to **Settings** → **Networking**
2. Click **"Generate Domain"** to create a public URL
3. Note your Railway URL: `https://your-backend.railway.app`

### 4.5 Update Frontend Environment Variable

After Railway deployment, update Vercel environment variable:

1. Go back to Vercel project settings
2. Update `NEXT_PUBLIC_WS_URL` to: `wss://your-backend.railway.app`
3. Redeploy frontend to pick up the new WebSocket URL

---

## Step 5: Post-Deployment Verification

### 5.1 Verify Frontend

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Check that the homepage loads
3. Try signing up/logging in
4. Verify authentication works

### 5.2 Verify Backend

1. Visit your Railway health check: `https://your-backend.railway.app/health`
2. Should return: `{"status":"ok","timestamp":"..."}`

### 5.3 Verify WebSocket Connection

1. Open browser console on your frontend
2. Check for WebSocket connection errors
3. Verify WebSocket URL matches your Railway backend

### 5.4 Verify Database

1. In Supabase dashboard, go to **Table Editor**
2. Verify tables exist: `profiles`, `songs`, `events`, `event_items`
3. Create a test user and verify profile is created

---

## Step 6: Update Supabase Redirect URLs

After deployment, update Supabase auth redirect URLs:

1. Go to Supabase → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/**` (for all routes)

---

## Troubleshooting

### Build Fails on Vercel

- **Issue**: TypeScript errors
- **Solution**: Run `npm run type-check` locally and fix errors before pushing

### Backend Not Connecting

- **Issue**: CORS errors
- **Solution**: Verify `CORS_ORIGIN` in Railway matches your Vercel URL exactly

### Authentication Not Working

- **Issue**: Redirect URL mismatch
- **Solution**: Verify Supabase redirect URLs match your Vercel domain exactly

### WebSocket Connection Failed

- **Issue**: WebSocket URL incorrect
- **Solution**: Verify `NEXT_PUBLIC_WS_URL` uses `wss://` (secure) for production, not `ws://`

### Environment Variables Not Loading

- **Issue**: Variables not available at runtime
- **Solution**: 
  - Frontend: Ensure variables start with `NEXT_PUBLIC_`
  - Backend: Restart Railway service after adding variables
  - Both: Redeploy after adding/updating variables

---

## Continuous Deployment

Both Vercel and Railway automatically deploy on every push to `main` branch:

- **Vercel**: Auto-deploys frontend
- **Railway**: Auto-deploys backend

To deploy manually:
- **Vercel**: Go to project → **Deployments** → **Redeploy**
- **Railway**: Go to service → **Deployments** → **Redeploy**

---

## Next Steps

After successful deployment:

1. Set up custom domains (optional)
2. Configure monitoring and logging
3. Set up staging environment
4. Configure CI/CD workflows (already created in `.github/workflows/ci.yml`)

---

## Security Checklist

- [ ] All environment variables set in Vercel/Railway (not in code)
- [ ] `service_role` key only in Railway (backend), never in frontend
- [ ] CORS origin set correctly in Railway
- [ ] Supabase redirect URLs configured correctly
- [ ] Database RLS policies active
- [ ] No secrets committed to git

---

For local development setup, see `ENV_SETUP.md` and `QUICK_START.md`.
