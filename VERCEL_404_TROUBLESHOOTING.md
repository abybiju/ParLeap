# Vercel 404 Error Troubleshooting Guide

## Current Issue
Deployment succeeds but shows "404 NOT_FOUND" error when accessing the site.

## Root Cause Analysis

Based on [Vercel's NOT_FOUND documentation](https://vercel.com/docs/errors/NOT_FOUND), this error occurs when:
1. The requested resource cannot be found
2. The deployment exists but the app isn't serving routes correctly
3. Next.js framework isn't being detected properly

## Most Likely Causes

### 1. Framework Preset Not Set Correctly
**Problem:** Vercel might not be detecting Next.js automatically

**Solution:**
1. Go to Vercel Dashboard → Your Project → **Settings** → **General**
2. Scroll to **Framework Preset**
3. **Change it to "Next.js"** (if it's set to "Other" or "Vite")
4. Save and redeploy

### 2. Root Directory Configuration
**Problem:** Root directory might not be set correctly

**Solution:**
1. Go to **Settings** → **General**
2. Under **Root Directory**, ensure it's set to: `frontend`
3. Save and redeploy

### 3. Build Output Directory
**Problem:** Vercel might be looking in the wrong place for build output

**Solution:**
1. Go to **Settings** → **Build & Development Settings**
2. **Output Directory:** Should be `.next` (or leave empty for auto-detect)
3. **Framework:** Should be "Next.js" (or auto-detected)
4. Save and redeploy

### 4. Environment Variables Missing
**Problem:** Missing env vars might cause runtime errors

**Current Status:** You've added them, but verify:
- `NEXT_PUBLIC_SUPABASE_URL` is set
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
- `NEXT_PUBLIC_WS_URL` is set (can be temporary value)

**Verify:**
1. Go to **Settings** → **Environment Variables**
2. Ensure all three variables are present
3. Check they're enabled for **Production**, **Preview**, and **Development**
4. Values should NOT have quotes around them

### 5. Build Command Issue
**Problem:** Build command might be incorrect

**Solution:**
1. Go to **Settings** → **Build & Development Settings**
2. **Build Command:** Should be `npm run build` (or leave empty)
3. **Install Command:** Should be `npm install` (or leave empty)
4. Save and redeploy

## Step-by-Step Fix

### Option A: Let Vercel Auto-Detect Everything (Recommended)

1. **Remove all custom build settings:**
   - Go to **Settings** → **Build & Development Settings**
   - Clear/delete:
     - Build Command (leave empty)
     - Output Directory (leave empty)
     - Install Command (leave empty)
   - Set **Framework Preset** to "Next.js"

2. **Verify Root Directory:**
   - Should be: `frontend`

3. **Redeploy:**
   - Go to **Deployments** → Click **Redeploy** on latest

### Option B: Explicit Configuration

1. **Set Framework Preset:**
   - **Settings** → **General** → **Framework Preset**: `Next.js`

2. **Set Root Directory:**
   - **Settings** → **General** → **Root Directory**: `frontend`

3. **Set Build Settings:**
   - **Settings** → **Build & Development Settings**:
     - **Build Command:** `npm run build`
     - **Output Directory:** `.next`
     - **Install Command:** `npm install`
     - **Framework:** `Next.js`

4. **Redeploy**

## Verification Checklist

After making changes, verify:

- [ ] Framework Preset is set to "Next.js"
- [ ] Root Directory is set to "frontend"
- [ ] Build Command is `npm run build` (or empty)
- [ ] Output Directory is `.next` (or empty)
- [ ] Environment variables are set for all environments
- [ ] Latest deployment uses the correct commit
- [ ] Build logs show "Detected Next.js" or similar

## Check Build Logs

1. Go to **Deployments** → Click on latest deployment
2. Click **"Build Logs"** tab
3. Look for:
   - "Detected Next.js" message
   - Any errors during build
   - Runtime errors

## Expected Build Log Output

You should see something like:
```
Detected Next.js version: 14.2.33
Running "npm run build"
...
✓ Compiled successfully
✓ Generating static pages
```

## If Still Not Working

1. **Check Runtime Logs:**
   - Go to **Deployments** → Latest → **Runtime Logs**
   - Look for any errors when accessing the site

2. **Try accessing specific routes:**
   - `https://par-leap.vercel.app/auth/login` (should work even without env vars)
   - If this works but `/` doesn't, it's a routing issue

3. **Verify package.json:**
   - Ensure `next` is in dependencies (it is)
   - Ensure build script exists (it does)

4. **Contact Support:**
   - If none of the above works, the issue might be platform-specific
   - Share build logs and runtime logs with Vercel support

## Quick Test

After fixing settings, try:
1. Redeploy
2. Wait for build to complete
3. Visit: `https://par-leap.vercel.app/`
4. Should see: "ParLeap - AI-Powered Presentation Platform"

If you see the homepage, the 404 is fixed! Then proceed to add environment variables properly.
