# Phase 3 & 3.4: Production Deployment Guide

**Date:** December 22, 2025  
**Status:** Ready for Deployment  
**Target:** Railway (Backend) + Vercel (Frontend)

---

## 🚀 Pre-Deployment Checklist

### Verify Local Build Status

```bash
# Backend build
cd backend
npm run build  # Should complete with zero errors ✅

# Check TypeScript
npm run type-check  # Should pass ✅

# Check linting
npm run lint  # Should show zero errors ✅
```

### Verify All Changes Staged

```bash
# Status check
git status

# Should show:
# - backend/src/services/matcherService.ts (NEW)
# - backend/src/__tests__/matcher.test.ts (NEW)
# - backend/src/websocket/handler.ts (MODIFIED)
# - backend/src/services/eventService.ts (MODIFIED)
# - frontend/components/operator/MatchStatus.tsx (NEW)
# - frontend/components/operator/GhostText.tsx (MODIFIED)
# - frontend/components/WebSocketTest.tsx (MODIFIED)
# - Plus documentation files
```

---

## 📋 Step 1: Prepare GitHub Repository

### Push All Changes to GitHub

```bash
# From project root
git add -A

git commit -m "Phase 3 & 3.4 Complete: Fuzzy Matching Engine + Frontend Display

- Phase 3.1: Matching Service (matcherService.ts)
- Phase 3.2: WebSocket Integration (auto-advance)
- Phase 3.3: Test Suite (13/13 passing)
- Phase 3.4: Frontend Display (MatchStatus + GhostText)
- All TypeScript builds passing
- Zero linter errors
- Production ready"

git push origin main
```

### Verify Push Successful

```bash
# Check on GitHub
git log --oneline -5  # Should show your commit

# Verify all files are in remote
git branch -a
```

---

## 🔧 Step 2: Deploy Backend to Railway

### Connect to Railway

```bash
# Install Railway CLI if not already installed
npm install -g @railway/cli

# Login to Railway
railway login
```

### Configure Backend Service

**If creating new service:**

```bash
cd backend

# Create new Railway project
railway init

# Or use existing project
railway link

# Set project
railway project select
```

### Set Environment Variables

**In Railway Dashboard:**
1. Go to Settings → Variables
2. Add the following:

```
# Database
SUPABASE_URL=<your_supabase_url>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

# Port
PORT=3001

# Optional: Google Cloud STT
GOOGLE_APPLICATION_CREDENTIALS=<your_credentials_path>

# Logging
DEBUG_MATCHER=false
NODE_ENV=production
```

### Configure Build & Deploy

**In Railway Dashboard → Deployment:**

1. **Root Directory:** `backend`
2. **Build Command:** `npm install && npm run build`
3. **Start Command:** `npm start`
4. **Port:** `3001`

### Deploy

```bash
# From backend directory
railway up

# Or push to GitHub and Railway auto-deploys
git push origin main
```

### Verify Backend Deployment

```bash
# Get backend URL from Railway dashboard
# Should look like: https://parleap-backend.railway.app

# Test health endpoint
curl https://parleap-backend.railway.app/health

# Check logs
railway logs
```

---

## 🎨 Step 3: Deploy Frontend to Vercel

### Connect to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Or push to GitHub and Vercel auto-deploys
git push origin main
```

### Configure Frontend Project

**In Vercel Dashboard:**

1. **Project Settings → General:**
   - Framework: Next.js
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

2. **Environment Variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
   NEXT_PUBLIC_WS_URL=wss://parleap-backend.railway.app
   ```

### Deploy

```bash
# From frontend directory
vercel deploy --prod

# Or with Git auto-deployment
git push origin main  # Vercel auto-deploys
```

### Verify Frontend Deployment

```bash
# Check deployment status in Vercel dashboard
# Should show: Deployed ✅

# Test home page
curl https://parleap.vercel.app

# Test WebSocket test page
https://parleap.vercel.app/test-websocket
```

---

## 🔌 Step 4: Database Configuration (Supabase)

### Verify Supabase Setup

```bash
# Check that migrations have been run
# In Supabase dashboard → SQL Editor

# Should see tables:
# - profiles
# - songs
# - events
# - event_items
```

### Seed Mock Data (Optional)

```bash
# Run seed script with backend connected to Supabase
SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed
```

---

## 🧪 Step 5: End-to-End Testing

### Test Backend WebSocket

```bash
# Connect to backend WebSocket
wscat -c wss://parleap-backend.railway.app

# Send START_SESSION
{"type":"START_SESSION","payload":{"eventId":"demo-event"}}

# Should receive SESSION_STARTED with setlist
```

### Test Frontend Connection

1. Open: `https://parleap.vercel.app/test-websocket`
2. Click "Connect"
3. Click "START_SESSION"
4. Should see:
   - ✅ Connected status
   - ✅ Session started message
   - ✅ Ghost Text component
   - ✅ MatchStatus component

### Test Audio Capture

1. Click "Start Recording"
2. Speak: "Amazing grace how sweet the sound"
3. Should see:
   - ✅ Real-time transcription (Ghost Text)
   - ✅ STT confidence (0-100%)
   - ✅ Audio level meter
   - ✅ Matching indicator
   - ✅ Auto-advance (if confidence > 0.85)

### Test Auto-Advance

1. During recording, if match confidence > 0.85:
   - ✅ MatchStatus appears with confidence
   - ✅ "AI Matched" badge shows
   - ✅ Progress bar fills (green)
   - ✅ Matched line displayed
   - ✅ Auto-fades after 2-3 seconds

---

## 📊 Step 6: Monitoring & Logging

### Backend Monitoring

**In Railway Dashboard:**

```
- Monitor memory usage
- Check error rates
- View real-time logs
- Set up alerts for failures
```

**Key Metrics to Monitor:**
- WebSocket connection count
- Average matching latency
- Transcription errors
- Auto-advance success rate

### Frontend Monitoring

**In Vercel Dashboard:**

```
- Deployment status
- Build times
- Page performance
- Error tracking
```

### Application Logs

```bash
# View backend logs
railway logs

# View frontend logs
vercel logs

# Or check in dashboards
```

---

## 🔐 Step 7: Security Configuration

### Set Production Environment Variables

```bash
# Backend (Railway)
NODE_ENV=production
DEBUG_MATCHER=false

# Frontend (Vercel)
# No sensitive keys in .env (use .env.local)
```

### Enable HTTPS

- ✅ Railway: Auto HTTPS
- ✅ Vercel: Auto HTTPS
- ✅ WebSocket: Use `wss://` (secure)

### Configure CORS

**Backend (index.ts):**

```typescript
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://parleap.vercel.app',
  credentials: true
};

app.use(cors(corsOptions));
```

### Secrets Management

- ✅ Use Railway Secrets for backend
- ✅ Use Vercel Environment Variables for frontend
- ✅ Never commit `.env` files
- ✅ Use `.env.example` for templates

---

## 📈 Step 8: Performance Optimization

### Backend Optimization

```bash
# Monitor latency
# Target: <20ms matching, <50ms E2E

# Check in logs for timing info
[WS] Processing time: 12ms
```

### Frontend Optimization

```bash
# Use Vercel Analytics
# Monitor Core Web Vitals
# Target: Fastest paint, smooth animations
```

### Database Optimization

```bash
# Enable query cache for:
# - Event fetching
# - Song data
# - User profiles

# Add indexes for:
# - event_id
# - user_id
# - song_id
```

---

## 🆘 Troubleshooting

### WebSocket Connection Fails

```bash
# Check backend is running
curl https://parleap-backend.railway.app/health

# Check WebSocket URL in frontend
.env.local should have:
NEXT_PUBLIC_WS_URL=wss://parleap-backend.railway.app

# Check firewall/CORS
# Verify Railway logs for errors
```

### Frontend Build Fails

```bash
# Clear cache
vercel env pull
vercel build

# Check environment variables are set
vercel env list

# Check Node version compatibility
node --version  # Should be 18+
```

### Matching Not Working

```bash
# Check backend logs for matcher calls
railway logs | grep MATCH

# Verify rollback if needed
# Check confidence scores are above threshold (0.85)

# Tune threshold if too aggressive
# Set DEBUG_MATCHER=true for detailed logs
```

### Audio Not Capturing

```bash
# Check browser permissions
# Check microphone works locally first

# Check frontend logs for errors
vercel logs

# Verify WebSocket connected before recording
```

---

## 📝 Rollback Plan

### If Issues in Production

```bash
# Quick Rollback - Deploy Previous Version

# Backend
railway rollback  # Or redeploy previous commit

# Frontend
vercel rollback  # Or redeploy previous commit

# Git
git revert <commit-hash>
git push origin main
```

---

## ✅ Post-Deployment Checklist

```
Backend:
  ✅ Railway shows deployed and running
  ✅ Health endpoint responds
  ✅ WebSocket accepts connections
  ✅ Logs show no errors
  ✅ All services integrated (Supabase)

Frontend:
  ✅ Vercel shows deployed
  ✅ Home page loads
  ✅ Test page accessible
  ✅ No 404 errors
  ✅ WebSocket connects to backend

Integration:
  ✅ Frontend can reach backend
  ✅ WebSocket tunnel works
  ✅ Audio capture functional
  ✅ Matching algorithm works
  ✅ Auto-advance triggers
  ✅ UI shows confidence

Monitoring:
  ✅ Logging active
  ✅ Error tracking enabled
  ✅ Performance metrics collecting
  ✅ Alerts configured
  ✅ Dashboard accessible
```

---

## 🎉 Success Criteria

✅ Backend running on Railway  
✅ Frontend running on Vercel  
✅ WebSocket connection works  
✅ STT transcription flowing  
✅ Fuzzy matching operating  
✅ Auto-advance triggering  
✅ Frontend UI showing confidence  
✅ No errors in logs  
✅ Latency < 500ms  
✅ Ready for production use  

---

## 📞 Support & Next Steps

### If Deployment Succeeds
1. Announce to team
2. Monitor for 24 hours
3. Collect user feedback
4. Plan Phase 4 improvements

### If Issues Arise
1. Check logs in Railway/Vercel
2. Verify environment variables
3. Test WebSocket manually
4. Rollback if needed
5. Troubleshoot using guide above

---

## 🚀 Deployment Summary

```
Phase 3 & 3.4 Deployment Checklist:

PRE-DEPLOYMENT:
  ✅ Code changes verified
  ✅ Tests passing (13/13)
  ✅ Build clean (zero errors)
  ✅ All files staged

BACKEND DEPLOYMENT:
  ⏳ Push to GitHub
  ⏳ Configure Railway
  ⏳ Set environment variables
  ⏳ Deploy & verify

FRONTEND DEPLOYMENT:
  ⏳ Configure Vercel
  ⏳ Set environment variables
  ⏳ Deploy & verify

TESTING:
  ⏳ Test WebSocket connection
  ⏳ Test audio capture
  ⏳ Test auto-advance
  ⏳ Verify confidence display

MONITORING:
  ⏳ Enable logging
  ⏳ Set up alerts
  ⏳ Monitor metrics
  ⏳ Verify performance
```

**Ready to deploy! 🚀**

