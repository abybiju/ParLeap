# 🚨 Railway Frontend Deployment Fix

## Problem Identified

Your frontend service is crashing because Railway is trying to execute backend code during the frontend deployment. The error shows:

```
npm error at Object.<anonymous> (/app/backend/dist/services/eventService.js:13:20)
npm error at Object.<anonymous> (/app/backend/dist/config/supabase.js:7:11)
```

This happens because Railway detected the monorepo and tried to build/run everything together.

---

## ✅ Fixes Applied

### 1. **Separated Railway Configs**
- ✅ Created `frontend/railway.toml` - Frontend-specific config
- ✅ Created `backend/railway.toml` - Backend-specific config  
- ✅ Deleted root `railway.json` - Was causing conflicts

### 2. **Created Ignore File**
- ✅ Created `.railwayignore` - Tells Railway to ignore backend for frontend service

### 3. **Created Nixpacks Config**
- ✅ Created `frontend/nixpacks.toml` - Explicit build commands

---

## 🚀 **ACTION REQUIRED: Update Railway Settings**

### **For Frontend Service:**

1. **Go to Railway Dashboard**
   - Navigate to your frontend service (`@parleap/frontend`)

2. **Open Settings**
   - Click **Settings** tab
   - Go to **Build & Deploy** section

3. **Update Configuration:**
   ```
   Root Directory: frontend
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

4. **Environment Variables** (Verify these are set):
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app
   ```

5. **Save & Redeploy**
   - Click **Save**
   - Trigger a new deployment (or push a commit)

### **For Backend Service:**

1. **Go to Railway Dashboard**
   - Navigate to your backend service (`@parleap/backend`)

2. **Open Settings**
   - Click **Settings** tab
   - Go to **Build & Deploy** section

3. **Update Configuration:**
   ```
   Root Directory: backend
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

4. **Environment Variables** (Verify these are set):
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GOOGLE_APPLICATION_CREDENTIALS=./config/google-cloud-credentials.json (optional)
   PORT=3001 (or let Railway assign)
   ```

---

## 🔍 **Alternative: Use Railway Auto-Detection**

If the above doesn't work, try this:

1. **Delete all Railway config files** (temporarily):
   ```bash
   rm frontend/railway.toml
   rm backend/railway.toml
   rm frontend/nixpacks.toml
   ```

2. **Set Root Directory in Railway UI:**
   - Frontend service: `frontend`
   - Backend service: `backend`

3. **Railway will auto-detect:**
   - Frontend: Next.js (will use `npm run build` and `npm start`)
   - Backend: Node.js (will use `npm start`)

---

## ✅ **Verification Checklist**

After updating settings, verify:

- [ ] Frontend builds successfully (no backend errors)
- [ ] Frontend starts with `npm start`
- [ ] Backend builds successfully
- [ ] Backend starts with `npm start`
- [ ] Both services show "Online" status
- [ ] Frontend can connect to backend WebSocket
- [ ] No errors in deployment logs

---

## 🐛 **If Still Crashing**

### Check Deployment Logs:

1. Go to Railway → Frontend Service → **Deploy Logs**
2. Look for:
   - Build errors
   - Missing dependencies
   - Environment variable issues
   - Port conflicts

### Common Issues:

**Issue:** "Cannot find module"
- **Fix:** Ensure `npm install` runs in correct directory

**Issue:** "Port already in use"
- **Fix:** Railway assigns ports automatically, don't hardcode

**Issue:** "Environment variable missing"
- **Fix:** Add all required env vars in Railway dashboard

---

## 📝 **Files Changed**

```
✅ Created: frontend/railway.toml
✅ Created: backend/railway.toml
✅ Created: frontend/nixpacks.toml
✅ Created: .railwayignore
✅ Deleted: railway.json (moved to backend/)
✅ Created: DEPLOYMENT_FIX.md (this file)
```

---

## 🎯 **Expected Result**

After fixing:
- ✅ Frontend deploys successfully
- ✅ Backend deploys successfully  
- ✅ Both services run independently
- ✅ No cross-contamination between services
- ✅ WebSocket connection works

---

**Next Step:** Update Railway service settings as described above, then redeploy! 🚀

