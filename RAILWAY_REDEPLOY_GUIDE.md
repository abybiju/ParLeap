# Railway Redeploy Guide - Force Update After Environment Variable Changes

**Problem**: Railway doesn't always auto-redeploy when environment variables are updated.  
**Solution**: Force a manual redeploy to pick up new environment variables.

---

## 🔄 Method 1: Manual Redeploy (Recommended)

### Steps:

1. **Open Railway Dashboard**
   - Go to: https://railway.app/dashboard
   - Select your backend project: `parleapbackend-production`

2. **Navigate to Deployments**
   - Click on your backend service (`@parleap/backend`)
   - Go to **Deployments** tab (top navigation)

3. **Trigger Manual Redeploy**
   - Find the latest deployment
   - Click the **three dots (⋯)** menu on the right
   - Select **"Redeploy"**
   - Confirm the redeploy

4. **Wait for Deployment**
   - Watch the build logs
   - Should complete in 2-3 minutes
   - Look for: `✅ Supabase configured and connected` in deploy logs

---

## 🔄 Method 2: Push Empty Commit (Alternative)

If Method 1 doesn't work, trigger a redeploy via Git:

```bash
cd "/Users/abybiju/ParLeap AI"
git commit --allow-empty -m "chore: trigger Railway redeploy for env vars"
git push origin main
```

Railway will detect the push and redeploy automatically.

---

## 🔄 Method 3: Restart Service (Quick Fix)

1. **Open Railway Dashboard**
   - Go to your backend service
   - Click **Settings** tab
   - Scroll to **"Restart"** section
   - Click **"Restart Service"**

**Note**: This restarts the container but doesn't rebuild. Use if you just need to reload environment variables.

---

## ✅ Verify Environment Variables Are Set

Before redeploying, verify your environment variables in Railway:

1. **Go to Variables Tab**
   - In Railway dashboard
   - Select backend service
   - Click **Variables** tab

2. **Verify These Are Set**:
   - `SUPABASE_URL` - Should be your new project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Should be your new service_role key
   - `SUPABASE_FALLBACK_TO_MOCK` - Should be `false` (or `true` if testing)

3. **Check for Typos**
   - Make sure URLs don't have trailing slashes
   - Make sure keys are complete (they're long strings)

---

## 🔍 What to Look For in Logs After Redeploy

### ✅ Success Indicators:
```
✅ Supabase configured and connected
   URL: https://xxxxx.supabase.co...
🚀 Backend server running on port 8080
🛰️ WebSocket server ready for connections
```

### ⚠️ Failure Indicators:
```
⚠️  Supabase not configured - using mock data mode
   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env for real data
```

---

## 🐛 Troubleshooting

### Issue: Still seeing mock data warning after redeploy

**Check 1**: Environment variables saved?
- Go to Variables tab
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present
- Make sure they're not empty

**Check 2**: Correct environment?
- Railway has different environments (Production, Preview, etc.)
- Make sure variables are set for the correct environment
- Check the dropdown at top of Variables page

**Check 3**: Variables have correct names?
- Must be exactly: `SUPABASE_URL` (not `SUPABASE_URLS` or `SUPABASE_URI`)
- Must be exactly: `SUPABASE_SERVICE_ROLE_KEY` (not `SUPABASE_KEY`)

**Check 4**: Redeploy actually happened?
- Check deployment timestamp
- Should be recent (within last few minutes)
- Look at build logs to confirm new build ran

---

## 📝 Quick Checklist

- [ ] Environment variables updated in Railway Variables tab
- [ ] Variables saved (no unsaved changes warning)
- [ ] Manual redeploy triggered (or empty commit pushed)
- [ ] Deployment completed successfully
- [ ] Logs show: `✅ Supabase configured and connected`
- [ ] No mock data warnings in logs

---

**After redeploy, check the logs again. You should see the Supabase connection message!**
