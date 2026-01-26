# Deployment Checklist - January 25, 2026

## Critical Issues to Fix

### Issue 1: Database Migration Not Applied ⚠️
**Error**: `Could not find the 'ccli_number' column of 'songs' in the schema cache`

**Action Required**: 
- ✅ Migration guide created: `SUPABASE_MIGRATION_002.md`
- ⏭️ **YOU MUST**: Run the SQL migration in Supabase dashboard (see guide)

### Issue 2: Code Not Deployed ⚠️
**Symptom**: Production site still shows old code (stanza parser not working)

**Action Required**: 
- ⏭️ **YOU MUST**: Push commits to GitHub (see commands below)
- ⏭️ **YOU MUST**: Wait for Vercel to auto-deploy

---

## Step-by-Step Fix Process

### Step 1: Apply Database Migration (CRITICAL - Do This First)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your ParLeap project

2. **Run Migration SQL**
   - Click **SQL Editor** → **New query**
   - Paste this SQL:
     ```sql
     ALTER TABLE songs ADD COLUMN IF NOT EXISTS ccli_number TEXT;
     ```
   - Click **Run**
   - Verify success

3. **Wait 2-3 minutes** for schema cache to refresh

**See detailed guide**: `SUPABASE_MIGRATION_002.md`

---

### Step 2: Push Code to GitHub

**When network is available**, run these commands:

```bash
cd "/Users/abybiju/ParLeap AI"

# Check what needs to be pushed
git log origin/main..HEAD --oneline

# Push all commits
git push origin main
```

**Expected commits to push**:
```
d338729 docs: Add Supabase migration 002 guide for CCLI column
9cdb357 docs: Update all documentation for January 25, 2026 session
a893fc1 docs: Add Song Library UX fixes documentation (Jan 25, 2026)
ea819de fix: Improve stanza parser and enhance preview UX in Song Library
16a5781 docs: Update documentation for Songs Library feature (Jan 25, 2026)
8c2f269 feat: Add Songs Library with Notion-style editor
```

---

### Step 3: Wait for Vercel Auto-Deploy

1. **Check GitHub**
   - Go to: https://github.com/abybiju/ParLeap
   - Verify commits are pushed

2. **Check Vercel**
   - Go to: https://vercel.com/dashboard
   - Select your ParLeap project
   - Go to **Deployments** tab
   - Wait for new deployment to start (should auto-trigger)
   - Wait for deployment to complete (~2-3 minutes)

3. **If Auto-Deploy Doesn't Trigger**
   - Go to Vercel → Deployments
   - Click **"Redeploy"** on latest deployment
   - Or manually trigger: Settings → Git → Redeploy

---

### Step 4: Verify Production Fixes

**Test URL**: https://www.parleap.com/songs

#### Test 1: CCLI Field Optional ✅
- [ ] Click "New Song"
- [ ] Fill in Title: "Test Song"
- [ ] Leave CCLI # **empty**
- [ ] Add some lyrics
- [ ] Click "Create Song"
- [ ] ✅ Should save WITHOUT error about ccli_number column

#### Test 2: Stanza Parser ✅
- [ ] Click "New Song"
- [ ] Paste lyrics with **blank lines** between stanzas:
  ```
  Stanza 1 line 1
  Stanza 1 line 2

  Stanza 2 line 1
  Stanza 2 line 2
  ```
- [ ] Check right panel (Slide Preview)
- [ ] ✅ Should show **2 separate cards** (Slide 1 and Slide 2)
- [ ] ✅ NOT one big card with all lines

#### Test 3: Single Newlines (Current Behavior)
- [ ] Paste lyrics with **single newlines only** (no blank lines)
- [ ] ✅ Should show as **one card** (current expected behavior)
- [ ] This is correct until CCLI API integration

---

## Verification Checklist

### Database
- [ ] Migration SQL executed successfully
- [ ] Column `ccli_number` exists in `songs` table
- [ ] Column is nullable (allows NULL)
- [ ] Schema cache refreshed (waited 2-3 minutes)

### Code Deployment
- [ ] All commits pushed to GitHub
- [ ] Vercel deployment triggered
- [ ] Deployment completed successfully
- [ ] No build errors in Vercel logs

### Production Testing
- [ ] Can create song with empty CCLI field
- [ ] Can create song with CCLI number
- [ ] Stanza parser splits on blank lines
- [ ] Preview shows multiple cards when stanzas separated
- [ ] No console errors in browser

---

## Troubleshooting

### Issue: "Still getting ccli_number error after migration"
**Solutions**:
1. Wait longer (5 minutes) for schema cache
2. Hard refresh browser (Ctrl+Shift+R)
3. Clear browser cache
4. Check Supabase → Table Editor → songs → verify column exists
5. Restart Supabase project (Settings → Restart)

### Issue: "Vercel not deploying"
**Solutions**:
1. Check GitHub webhook is configured
2. Manually trigger redeploy in Vercel
3. Check Vercel build logs for errors
4. Verify `frontend/` is set as root directory

### Issue: "Stanza parser still not working"
**Solutions**:
1. Verify deployment completed (check Vercel)
2. Hard refresh browser
3. Check browser console for JavaScript errors
4. Verify code was actually pushed (check GitHub)

---

## Files Changed

### Code Files
- `frontend/lib/schemas/song.ts` - Enhanced stanza parser
- `frontend/components/songs/SongPreviewCards.tsx` - Better preview UI
- `frontend/app/songs/actions.ts` - Already handles null CCLI
- `frontend/app/page.tsx` - Added navigation

### Database
- `supabase/migrations/002_add_ccli_number.sql` - Migration file

### Documentation
- `SUPABASE_MIGRATION_002.md` - Migration guide
- `DEPLOYMENT_CHECKLIST_JAN25.md` - This file
- Updated: PROJECT_STATUS_COMPLETE.md, PROJECT_PLAN.md, README.md

---

## Success Criteria

✅ **Migration Applied**: No more "ccli_number column" errors  
✅ **Code Deployed**: Stanza parser works in production  
✅ **CCLI Optional**: Can save songs without CCLI number  
✅ **Stanza Preview**: Shows multiple cards when blank lines present  

---

**Status**: Ready for deployment once network is available and migration is applied.
