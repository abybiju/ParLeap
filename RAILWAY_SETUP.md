# Railway Backend Deployment - Quick Setup Guide

## ✅ Step 3 Complete: CORS Configuration Added

The backend code has been updated with CORS middleware. The server will now accept requests from your Vercel frontend.

---

## Manual Steps Required (Follow in Order)

### Step 1: Connect Railway to GitHub

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access GitHub if prompted
5. Select your `ParLeap` repository
6. Railway will automatically create a new service

---

### Step 2: Configure Railway Service Settings

1. Click on the newly created service
2. Go to **Settings** tab
3. Set the following:

   **Root Directory:**
   ```
   backend
   ```

   **Build Command** (should auto-detect from `railway.json`):
   ```
   cd backend && npm install && npm run build
   ```

   **Start Command** (should auto-detect from `railway.json`):
   ```
   cd backend && npm start
   ```

---

### Step 4: Generate Public Domain

1. In Railway service → **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the generated domain (e.g., `https://your-service.railway.app`)
4. **Save this URL** - you'll need it for Step 5 and Step 7

---

### Step 5: Configure Environment Variables

In Railway service → **Variables** tab, add these variables:

**Required (add these now):**
```
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://par-leap.vercel.app
```

**Important:** 
- `CORS_ORIGIN` must be your **Vercel frontend domain**, NOT the Railway backend URL
- Your production domain is: `https://par-leap.vercel.app`
- Do NOT use the Railway backend URL (`parleapbackend-production.up.railway.app`) - that's incorrect!

**Supabase (add these after Supabase project is set up):**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Optional (for future AI transcription):**
```
ELEVENLABS_API_KEY=your_key_here
GOOGLE_CLOUD_API_KEY=your_key_here
```

After adding variables, Railway will automatically redeploy.

---

### Step 6: Verify Deployment

1. Wait for Railway deployment to complete (check **Deployments** tab)
2. Test root endpoint in your browser:
   ```
   https://your-service.railway.app/
   ```
   Expected response:
   ```json
   {
     "service": "ParLeap Backend API",
     "status": "running",
     "version": "1.0.0",
     "endpoints": {
       "health": "/health"
     }
   }
   ```
3. Test health endpoint:
   ```
   https://your-service.railway.app/health
   ```
   Expected response:
   ```json
   {"status":"ok","timestamp":"2025-01-XX..."}
   ```
4. Check Railway logs for any startup errors (should see: `🚀 Backend server running on port 8080` or similar)

---

### Step 7: Update Vercel Frontend Configuration

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `par-leap` project
3. Go to **Settings** → **Environment Variables**
4. Add or update `NEXT_PUBLIC_WS_URL`:
   ```
   wss://your-service.railway.app
   ```
   **Important:** 
   - Use `wss://` (secure WebSocket) not `ws://`
   - Replace `your-service.railway.app` with your actual Railway domain from Step 4
5. Save the variable
6. Go to **Deployments** tab and click **"Redeploy"** on the latest deployment

---

## Verification Checklist

- [x] Railway service deployed successfully ✅
- [x] Root endpoint (`/`) returns API info ✅
- [x] Health endpoint (`/health`) returns `{"status":"ok"}` ✅
- [x] Railway logs show: `🚀 Backend server running on port 8080` ✅
- [x] No errors in Railway logs ✅
- [x] Public domain generated and accessible ✅
- [x] Environment variables configured (PORT, NODE_ENV, CORS_ORIGIN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) ✅
- [ ] Vercel environment variable `NEXT_PUBLIC_WS_URL` updated (Next step)
- [ ] Frontend redeployed with new WebSocket URL (Next step)

---

## Troubleshooting

### Health endpoint returns 404
- Check that Root Directory is set to `backend` in Railway settings
- Verify build completed successfully in Railway logs

### CORS errors in browser console
- Verify `CORS_ORIGIN` in Railway matches your exact Vercel domain
- Check that the domain includes `https://` protocol

### WebSocket connection fails
- Verify `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`)
- Check Railway domain is correct
- Ensure backend is running (check Railway logs)

### Build fails in Railway
- Check Railway logs for specific error messages
- Verify `railway.json` is in the root directory
- Ensure all dependencies are listed in `backend/package.json`

---

## Next Steps After Deployment

1. ✅ Backend deployed and accessible
2. ⏭️ Set up Supabase project (see `SETUP_CHECKLIST.md`)
3. ⏭️ Add Supabase environment variables to Railway
4. ⏭️ Implement WebSocket message protocol (Phase 2)
5. ⏭️ Add audio capture and streaming (Phase 2)
6. ⏭️ Integrate AI transcription service (Phase 2)

---

## Current Backend Status

- ✅ Express server configured
- ✅ WebSocket server initialized
- ✅ CORS middleware configured
- ✅ Root endpoint (`/`) - Returns API information
- ✅ Health check endpoint (`/health`) - Returns status and timestamp
- ✅ TypeScript compilation working
- ✅ Build process verified
- ✅ **Deployed to Railway** - Live at `parleapbackend-production.up.railway.app`

## Deployment Complete ✅

The backend has been successfully deployed to Railway! Both endpoints are working:
- Root: `https://parleapbackend-production.up.railway.app/`
- Health: `https://parleapbackend-production.up.railway.app/health`

**Next Steps:**
1. Update Vercel environment variable `NEXT_PUBLIC_WS_URL` to `wss://parleapbackend-production.up.railway.app`
2. Redeploy Vercel frontend
3. Test WebSocket connection from frontend

