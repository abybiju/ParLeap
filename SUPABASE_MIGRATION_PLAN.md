# Supabase Migration Plan - Fresh Start

**Date**: January 19, 2026  
**Objective**: Migrate from stuck Supabase project to fresh new project  
**Status**: Ready to execute

---

## 🎯 Migration Strategy

**Approach**: Create a brand new Supabase project, run migrations, update environment variables, and test. Treat the old project as dead.

---

## 📋 Pre-Migration Checklist

- [ ] Backup any important data from old project (if accessible)
- [ ] Note down current environment variable values (for reference)
- [ ] Ensure migration SQL file is ready (`supabase/migrations/001_initial_schema.sql`)
- [ ] Have Railway and Vercel dashboards open

---

## 🔧 Step-by-Step Migration Process

### Step 1: Create New Supabase Project

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Click **"New Project"**

2. **Fill Project Details**
   - **Name**: `ParLeap Production` (or your preferred name)
   - **Database Password**: Generate a strong password (SAVE THIS!)
   - **Region**: Choose closest to your users (or Railway/Vercel region)
   - **Pricing Plan**: Free tier is fine for now

3. **Wait for Project Creation**
   - Usually takes 1-2 minutes
   - Wait for "Project is ready" message

4. **Verify Project is Active**
   - Check project dashboard loads
   - No "pausing" or error states

---

### Step 2: Run Database Migrations

1. **Open SQL Editor**
   - In new Supabase project dashboard
   - Navigate to **SQL Editor** (left sidebar)

2. **Run Migration**
   - Open `supabase/migrations/001_initial_schema.sql` from this repo
   - Copy entire contents
   - Paste into SQL Editor
   - Click **"Run"** (or press Cmd/Ctrl + Enter)

3. **Verify Tables Created**
   - Run this query in SQL Editor:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```
   - Should see: `event_items`, `events`, `profiles`, `songs`

4. **Verify RLS Policies**
   - Run this query:
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
   ```
   - Should see multiple policies for each table

---

### Step 3: Get API Keys from New Project

1. **Navigate to API Settings**
   - Go to **Settings** → **API** (left sidebar)

2. **Copy Required Values**
   - **Project URL**: `https://xxxxx.supabase.co` (copy this)
   - **anon public key**: `eyJhbGc...` (copy this - for frontend)
   - **service_role key**: `eyJhbGc...` (copy this - for backend, KEEP SECRET!)

3. **Save Keys Securely**
   - Store in a temporary file or password manager
   - We'll use these in next steps

---

### Step 4: Update Railway Backend Environment Variables

1. **Open Railway Dashboard**
   - Go to: https://railway.app/dashboard
   - Select your backend project: `parleapbackend-production`

2. **Navigate to Variables Tab**
   - Click on your service
   - Go to **Variables** tab

3. **Update Supabase Variables**
   - Find `SUPABASE_URL`
     - **Old**: `https://old-project.supabase.co`
     - **New**: `https://new-project.supabase.co` (from Step 3)
   - Find `SUPABASE_SERVICE_ROLE_KEY`
     - **Old**: `eyJhbGc...` (old key)
     - **New**: `eyJhbGc...` (new service_role key from Step 3)
   - (Recommended) Find `MATCHER_ALLOW_PARTIAL`
     - Set to `true` for faster matching on partial transcripts

4. **Disable Mock Fallback** (Optional)
   - Find `SUPABASE_FALLBACK_TO_MOCK`
   - Change from `true` to `false` (once we verify it works)

5. **Save Changes**
   - Railway will auto-redeploy when variables change
   - Wait for deployment to complete (~2-3 minutes)

---

### Step 5: Update Vercel Frontend Environment Variables

1. **Open Vercel Dashboard**
   - Go to: https://vercel.com/dashboard
   - Select your project: `par-leap`

2. **Navigate to Settings → Environment Variables**

3. **Update Supabase Variables**
   - Find `NEXT_PUBLIC_SUPABASE_URL`
     - **Old**: `https://old-project.supabase.co`
     - **New**: `https://new-project.supabase.co` (from Step 3)
   - Find `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **Old**: `eyJhbGc...` (old anon key)
     - **New**: `eyJhbGc...` (new anon key from Step 3)

4. **Save Changes**
   - Variables are saved immediately
   - **Redeploy Required**: Go to **Deployments** tab
   - Click **"Redeploy"** on latest deployment
   - Wait for deployment (~2-3 minutes)

---

### Step 6: Seed Test Data (Optional but Recommended)

**Option A: Use Seed Script (Recommended)**

1. **Set up local environment**
   ```bash
   cd backend
   # Create .env file with new Supabase credentials
   echo "SUPABASE_URL=https://new-project.supabase.co" > .env
   echo "SUPABASE_SERVICE_ROLE_KEY=your_new_service_role_key" >> .env
   ```

2. **Run seed script**
   ```bash
   npx ts-node src/utils/seedDatabase.ts
   ```

3. **Note the Event ID**
   - The script will output an Event ID
   - Save this for testing

**Option B: Manual SQL (Alternative)**

1. **Create Test User Account**
   - Go to: https://www.parleap.com/auth/signup
   - Create a test account
   - Verify email if required

2. **Create Test Data via SQL**

   Run this in Supabase SQL Editor (replace `YOUR_USER_ID` with actual UUID from auth.users):

   ```sql
   -- Get your user ID first
   SELECT id, email FROM auth.users;

   -- Then create test data (replace YOUR_USER_ID)
   INSERT INTO profiles (id, username, subscription_tier)
   VALUES ('YOUR_USER_ID', 'testuser', 'free');

   -- Create a test song
   INSERT INTO songs (user_id, title, artist, lyrics)
   VALUES (
     'YOUR_USER_ID',
     'Amazing Grace',
     'John Newton',
     'Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see'
   );

   -- Create a test event
   INSERT INTO events (user_id, name, event_date, status)
   VALUES (
     'YOUR_USER_ID',
     'Test Event',
     NOW() + INTERVAL '1 day',
     'draft'
   );

   -- Get the event and song IDs
   SELECT id FROM events WHERE name = 'Test Event';
   SELECT id FROM songs WHERE title = 'Amazing Grace';

   -- Add song to event (replace EVENT_ID and SONG_ID)
   INSERT INTO event_items (event_id, song_id, sequence_order)
   VALUES ('EVENT_ID', 'SONG_ID', 1);
   ```

---

### Step 7: Force Railway Redeploy (IMPORTANT!)

**Railway doesn't always auto-redeploy when environment variables change. You MUST manually trigger a redeploy.**

1. **Trigger Manual Redeploy**
   - Go to Railway dashboard
   - Select your backend service (`@parleap/backend`)
   - Go to **Deployments** tab
   - Click **three dots (⋯)** on latest deployment
   - Select **"Redeploy"**
   - Wait for deployment to complete (~2-3 minutes)

   **OR** push an empty commit:
   ```bash
   git commit --allow-empty -m "chore: trigger Railway redeploy"
   git push origin main
   ```

2. **Check Backend Logs After Redeploy**
   - Go to Railway dashboard
   - Open **Deployments** → Latest deployment → **Deploy Logs**
   - Look for: `✅ Supabase configured and connected`
   - Should NOT see: `⚠️ Supabase not configured - using mock data mode`

**See [RAILWAY_REDEPLOY_GUIDE.md](./RAILWAY_REDEPLOY_GUIDE.md) for detailed redeploy instructions.**

2. **Test WebSocket Connection**
   - Go to: https://www.parleap.com/test-websocket
   - Click **"Connect"**
   - Should connect successfully
   - Click **"Start Session"**
   - Use a real event ID from your test data (not mock UUID)
   - Should load real event data (not mock)

3. **Test Authentication**
   - Go to: https://www.parleap.com/auth/login
   - Log in with test account
   - Should redirect to dashboard successfully

4. **Check Frontend Console**
   - Open browser DevTools (F12)
   - Check Console for errors
   - Should NOT see Supabase connection errors

---

### Step 8: Update Documentation

- [ ] Update `PROJECT_STATUS_COMPLETE.md`:
  - [ ] Change Supabase status from "Mock fallback" to "Active"
  - [ ] Update "Recent Updates" section
- [ ] Update `PROJECT_PLAN.md`:
  - [ ] Mark Supabase integration as complete
  - [ ] Add migration to "Recent Updates"
- [ ] Update `README.md`:
  - [ ] Update deployment status
  - [ ] Remove mock data warnings

---

## 🔄 Rollback Plan (If Something Goes Wrong)

If the migration fails or causes issues:

1. **Revert Environment Variables**
   - Railway: Change back to old Supabase URL/key
   - Vercel: Change back to old Supabase URL/key
   - Redeploy both

2. **Re-enable Mock Fallback**
   - Railway: Set `SUPABASE_FALLBACK_TO_MOCK=true`
   - Redeploy backend

3. **System Returns to Mock Data Mode**
   - Everything continues working with mock data
   - No downtime

---

## ✅ Success Criteria

Migration is successful when:

- [ ] New Supabase project is active and healthy
- [ ] All tables and RLS policies created successfully
- [ ] Railway backend connects to new Supabase (logs confirm)
- [ ] Vercel frontend connects to new Supabase (no console errors)
- [ ] WebSocket test page loads real event data (not mock)
- [ ] Authentication works (login/signup)
- [ ] Test data can be created and queried

---

## 📝 Post-Migration Tasks

1. **Clean Up Old Project** (Optional)
   - Delete old Supabase project if no longer needed
   - Or keep as backup for a few days

2. **Monitor for Issues**
   - Watch Railway logs for 24 hours
   - Watch Vercel logs for errors
   - Test WebSocket connection regularly

3. **Create Production Data**
   - Set up real events and songs
   - Test end-to-end flow with real data

---

## 🆘 Troubleshooting

### Issue: Railway still shows mock data warnings
- **Check**: Environment variables saved correctly?
- **Fix**: Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- **Action**: Redeploy Railway service

### Issue: Frontend shows authentication errors
- **Check**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` correct?
- **Fix**: Verify in Vercel environment variables
- **Action**: Redeploy Vercel frontend

### Issue: RLS policies blocking queries
- **Check**: User is authenticated?
- **Fix**: Ensure user is logged in before querying
- **Action**: Test with authenticated user

### Issue: Tables not found
- **Check**: Migration ran successfully?
- **Fix**: Re-run migration SQL in Supabase SQL Editor
- **Action**: Verify tables exist with `SELECT * FROM information_schema.tables`

---

## 📚 Reference Files

- Migration SQL: `supabase/migrations/001_initial_schema.sql`
- Environment Setup: `ENV_SETUP.md`
- Supabase Setup Guide: `supabase/README.md`

---

**Ready to execute?** Follow steps 1-7 in order. Good luck! 🚀
