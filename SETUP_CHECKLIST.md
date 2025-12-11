# ParLeap Production Setup Checklist

Follow this checklist to complete your production deployment setup.

## Current Status

- ✅ GitHub repository created and connected
- ✅ Vercel connected to GitHub
- ✅ **Vercel Frontend Deployment Successful** - Live at [par-leap.vercel.app](https://par-leap.vercel.app)
- ✅ Environment variables added to Vercel
- ✅ Framework Preset configured (Next.js)
- ⏭️ Railway backend setup needed (Next Step)
- ⏭️ Supabase database setup needed

---

## Step 1: Fix Vercel 404 Error (Environment Variables)

### 1.1 Add Environment Variables in Vercel

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your `par-leap` project
3. Go to **Settings** → **Environment Variables**
4. Add the following variables (you'll get these from Supabase in Step 2):

**For Production, Preview, and Development environments:**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

**Note:** `NEXT_PUBLIC_WS_URL` will be updated after Railway deployment in Step 5.

### 1.2 Redeploy

1. Go to **Deployments** tab
2. Click the three dots (⋯) on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete

**Expected Result:** The 404 error should be resolved and your homepage should load.

---

## Step 2: Set Up Supabase

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `ParLeap`
   - **Database Password**: Generate a strong password (save it securely!)
   - **Region**: Choose closest to your users
4. Click **"Create new project"**
5. Wait ~2 minutes for project to be created

### 2.2 Run Database Migration

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Open `supabase/migrations/001_initial_schema.sql` from your local project
4. Copy the entire file contents
5. Paste into the SQL Editor
6. Click **"Run"** (or press Cmd/Ctrl + Enter)
7. Verify success message appears

### 2.3 Get API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values (you'll need them for Vercel and Railway):

   - **Project URL**: `https://xxxxx.supabase.co`
     - Use for: `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   
   - **anon public key**: `eyJhbGc...` (long string)
     - Use for: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Vercel only)
   
   - **service_role key**: `eyJhbGc...` (long string, different from anon)
     - Use for: `SUPABASE_SERVICE_ROLE_KEY` (Railway only - KEEP SECRET!)

### 2.4 Configure Authentication Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   - `https://par-leap-*.vercel.app/auth/callback`
   - `https://par-leap-*.vercel.app/**` (wildcard for all routes)
3. Click **"Save"**

---

## Step 3: Connect Railway to GitHub

### 3.1 Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub if prompted
5. Select your `ParLeap` repository
6. Railway will create a new service automatically

### 3.2 Configure Service Settings

1. Click on the newly created service
2. Go to **Settings** tab
3. Configure:

   **Root Directory:**
   - Set to: `backend`

   **Build Command:**
   - Should auto-detect: `cd backend && npm install && npm run build`
   - (Already configured in `railway.json`)

   **Start Command:**
   - Should auto-detect: `cd backend && npm start`
   - (Already configured in `railway.json`)

### 3.3 Generate Public Domain

1. In Railway service, go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the generated domain: `https://your-service.railway.app`
4. **Save this URL** - you'll need it for Vercel environment variables

---

## Step 4: Add Railway Environment Variables

1. In Railway service, go to **Variables** tab
2. Add the following variables:

```
PORT=3001
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
CORS_ORIGIN=https://par-leap-*.vercel.app
```

**Optional (if using ElevenLabs):**
```
ELEVENLABS_API_KEY=your_elevenlabs_key_here
```

**Important Notes:**
- Replace `your-project.supabase.co` with your actual Supabase URL
- Replace `your_service_role_key_here` with your Supabase service_role key
- Replace `par-leap-*.vercel.app` with your actual Vercel domain (or use wildcard)

3. Railway will automatically redeploy after adding variables

### 4.1 Verify Railway Deployment

1. Wait for deployment to complete (check **Deployments** tab)
2. Test health endpoint: `https://your-service.railway.app/health`
3. Should return: `{"status":"ok","timestamp":"..."}`

---

## Step 5: Update Vercel WebSocket URL

### 5.1 Update Environment Variable

1. Go back to Vercel dashboard → Your project → **Settings** → **Environment Variables**
2. Find `NEXT_PUBLIC_WS_URL`
3. Update the value to: `wss://your-service.railway.app`
   - **Important:** Use `wss://` (secure WebSocket) not `ws://`
   - Replace `your-service.railway.app` with your actual Railway domain
4. Save the variable

### 5.2 Redeploy Vercel

1. Go to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Wait for deployment to complete

---

## Step 6: Verify Everything Works

### 6.1 Test Frontend

1. Visit your Vercel URL: `https://par-leap-*.vercel.app`
2. Should see the ParLeap homepage (no 404)
3. Try navigating to `/auth/login`
4. Should see the login page

### 6.2 Test Backend

1. Visit Railway health endpoint: `https://your-service.railway.app/health`
2. Should return: `{"status":"ok","timestamp":"..."}`

### 6.3 Test Database Connection

1. Try signing up a test user in the frontend
2. Check Supabase dashboard → **Authentication** → **Users**
3. Should see the new user created
4. Check **Table Editor** → **profiles** table
5. Should see a profile record for the user

---

## Troubleshooting

### Vercel Deployment Issues

- ✅ **404 Error Fixed:** Resolved by setting Framework Preset to "Next.js" in Vercel settings
- **If still seeing issues:** Check that root directory is set to `frontend` and Framework Preset is "Next.js"
- **Check:** Are environment variables set correctly in Vercel?
- **Check:** Did you redeploy after adding variables?

### Railway Deployment Fails

- **Check:** Is root directory set to `backend`?
- **Check:** Are all environment variables added?
- **Check:** Railway logs for specific error messages
- **Note:** CORS package is installed but not yet configured in backend code (may need to add CORS middleware if HTTP endpoints are accessed from frontend)

### WebSocket Connection Fails

- **Check:** Is `NEXT_PUBLIC_WS_URL` using `wss://` (not `ws://`)?
- **Check:** Is Railway domain correct?
- **Check:** Is CORS_ORIGIN in Railway set to your Vercel domain?

### Database Connection Issues

- **Check:** Are Supabase URL and keys correct?
- **Check:** Is the migration run successfully?
- **Check:** Are RLS policies active in Supabase?

---

## Quick Reference: Environment Variables

### Vercel (Frontend)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_WS_URL=wss://your-service.railway.app
```

### Railway (Backend)
```
PORT=3001
NODE_ENV=production
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
CORS_ORIGIN=https://par-leap-*.vercel.app
ELEVENLABS_API_KEY=your_key_here (optional)
```

---

## Next Steps After Setup

1. ✅ All services connected and deployed
2. ⏭️ Test authentication flow end-to-end
3. ⏭️ Test WebSocket connection
4. ⏭️ Set up custom domains (optional)
5. ⏭️ Configure monitoring and logging

---

**Need Help?** Check `DEPLOYMENT.md` for detailed deployment guide or `ENV_SETUP.md` for environment variable details.
