# Event Management UI - Next Steps Guide

**Status:** ✅ Implementation Complete (Validation: Feb 2026)  
**Date:** February 6, 2026

## Overview

The polymorphic setlist feature has been fully implemented. Follow these steps to deploy and test it.

---

## Step 1: Install Dependencies

**Location:** Frontend directory

```bash
cd frontend
npm install
```

**What this does:**
- Installs `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities`
- These packages enable the drag-and-drop functionality

**Expected output:**
```
added 15 packages in 2s
```

---

## Step 2: Run Database Migration

**Location:** Supabase Dashboard

### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file: `supabase/migrations/011_add_polymorphic_setlist_items.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run**

### Option B: Via Supabase CLI (If configured)

```bash
supabase migration up
```

**What this does:**
- Adds `item_type`, `bible_ref`, `media_url`, `media_title` columns to `event_items`
- Sets default `item_type='SONG'` for existing rows
- Adds constraint to ensure data integrity
- Creates index for performance

**Verification:**
After running, check that:
- Existing `event_items` rows have `item_type = 'SONG'`
- New columns are visible in Supabase table editor

---

## Step 3: Regenerate TypeScript Types

**Location:** Frontend directory

### Option A: Via Supabase CLI (Recommended)

```bash
cd frontend
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/types.ts
```

**Or if using Supabase CLI locally:**

```bash
supabase gen types typescript --local > frontend/lib/supabase/types.ts
```

### Option B: Manual Update

If CLI isn't available, manually add these types to `frontend/lib/supabase/types.ts`:

```typescript
event_items: {
  Row: {
    id: string;
    event_id: string;
    song_id: string | null;
    sequence_order: number;
    item_type: 'SONG' | 'BIBLE' | 'MEDIA' | null;
    bible_ref: string | null;
    media_url: string | null;
    media_title: string | null;
    // ... other existing fields
  };
  // ... Insert/Update types
}
```

**What this does:**
- Updates TypeScript types to match new database schema
- Enables type safety for polymorphic items

---

## Step 4: Build and Test Locally

### 4.1 Build Frontend

```bash
cd frontend
npm run build
```

**Check for errors:**
- Should compile without TypeScript errors
- Look for any missing type definitions

### 4.2 Start Development Server

```bash
npm run dev
```

**Expected:**
- Server starts on `http://localhost:3000`
- No console errors

---

## Step 5: Test Backward Compatibility

**Goal:** Verify existing song-only events still work

### Test Steps:

1. **Open Existing Event**
   - Navigate to `/events/[existing-event-id]`
   - Should load without errors
   - Setlist should show existing songs

2. **Verify Song Display**
   - Songs should appear in setlist
   - Drag-and-drop should work
   - Add/remove songs should work

3. **Check Database**
   - In Supabase, verify `event_items` table
   - Existing rows should have `item_type = 'SONG'`
   - `song_id` should still be populated

**Expected Result:**
- ✅ Existing events display correctly
- ✅ No errors in browser console
- ✅ Songs can be reordered

---

## Step 6: Test New Features

### 6.1 Test Songs Tab

1. **Add Song**
   - Click "Songs" tab in Library
   - Click a song to add it
   - Verify it appears in Setlist

2. **Reorder Songs**
   - Drag a song up/down in Setlist
   - Verify order updates
   - Check browser console for success toast

### 6.2 Test Bible Tab

1. **Add Bible Reference**
   - Click "Bible" tab in Library
   - Enter reference: `John 3:16-18`
   - Click "Add Bible Reference"
   - Verify purple card appears in Setlist

2. **Verify Display**
   - Card should show reference text
   - Should have purple border/background
   - Should have Book icon

### 6.3 Test Media Tab

1. **Add Media**
   - Click "Media" tab in Library
   - Enter title: `Welcome Video`
   - Enter URL: `https://example.com/video.mp4`
   - Click "Add Media"
   - Verify green card appears in Setlist

2. **Verify Display**
   - Card should show media title
   - Should show URL (truncated)
   - Should have green border/background
   - Should have Image icon

### 6.4 Test Mixed Setlist

1. **Create Mixed Setlist**
   - Add 2 songs
   - Add 1 Bible reference
   - Add 1 Media item
   - Reorder them (drag Bible between songs)

2. **Verify**
   - All items display correctly
   - Order persists after refresh
   - Colors/icons are correct

---

## Step 7: Test Live Session

**Goal:** Verify polymorphic setlist works in live mode

### Test Steps:

1. **Start Live Session**
   - Go to `/live/[event-id]`
   - Click "Start Session"
   - Verify session starts

2. **Check Setlist Panel**
   - Right panel should show all items (Songs, Bible, Media)
   - Current item should be highlighted
   - Manual NEXT/PREV should work

3. **Test Song Matching**
   - Songs should match audio and advance
   - Bible/Media items should skip matching (no audio processing)

**Expected:**
- ✅ Session starts successfully
- ✅ Setlist displays all item types
- ✅ Only songs trigger audio matching
- ✅ Manual navigation works for all types

---

## Step 8: Deploy to Production

### 8.1 Commit Changes

```bash
git add .
git commit -m "feat: add polymorphic setlist with drag-and-drop UI"
git push origin main
```

### 8.2 Deploy Migration

**Railway (Backend):**
- Migration runs automatically if using Supabase migrations
- Or run manually via Supabase dashboard

**Vercel (Frontend):**
- Auto-deploys from `main` branch
- Verify build succeeds

### 8.3 Verify Production

1. Check production URLs:
   - Frontend: `https://www.parleap.com/events/[id]`
   - Backend: `https://parleapbackend-production.up.railway.app/health`

2. Test in production:
   - Create new event
   - Add all item types
   - Verify drag-and-drop works

---

## Troubleshooting

### Issue: Migration Fails

**Error:** `column "item_type" already exists`

**Solution:**
- Migration already ran
- Skip to Step 3 (regenerate types)

### Issue: TypeScript Errors

**Error:** `Property 'item_type' does not exist`

**Solution:**
- Regenerate types (Step 3)
- Or manually add types to `frontend/lib/supabase/types.ts`

### Issue: Drag-and-Drop Not Working

**Error:** No drag functionality

**Solution:**
1. Verify `npm install` completed (Step 1)
2. Check browser console for errors
3. Verify @dnd-kit packages in `node_modules`

### Issue: Existing Events Broken

**Error:** Setlist not loading

**Solution:**
1. Verify migration ran (Step 2)
2. Check `event_items.item_type` is set to 'SONG'
3. Check browser console for errors

### Issue: Bible/Media Not Saving

**Error:** "Migration 011 required"

**Solution:**
- Migration not run yet
- Complete Step 2 first

---

## Verification Checklist

Before considering complete, verify:

- [ ] Dependencies installed (`npm install` completed)
- [ ] Migration ran successfully (check Supabase)
- [ ] TypeScript types regenerated
- [ ] Frontend builds without errors (`npm run build`)
- [ ] Existing events still work (backward compatibility)
- [ ] Can add Songs to setlist
- [ ] Can add Bible references to setlist
- [ ] Can add Media items to setlist
- [ ] Drag-and-drop reordering works
- [ ] Items persist after page refresh
- [ ] Live session handles mixed setlist
- [ ] Production deployment successful

---

## Success Criteria

✅ **Feature is complete when:**
1. All three item types (Songs, Bible, Media) can be added
2. Drag-and-drop reordering works smoothly
3. Existing song-only events continue to work
4. Live sessions handle polymorphic setlists
5. No TypeScript or runtime errors

---

## Next Features (Future)

After this is working, consider:

1. **Bible Reference Picker** - Visual book/chapter/verse selector
2. **Media Preview** - Thumbnail/image preview for media items
3. **Bulk Import** - Import multiple items at once
4. **Setlist Templates** - Save/reuse common setlist patterns
5. **Item Notes** - Add notes to setlist items

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Check Railway logs for backend errors
3. Verify migration ran successfully
4. Check TypeScript types are updated
5. Review this guide's troubleshooting section

---

**Last Updated:** February 6, 2026  
**Implementation Status:** ✅ Complete - Ready for Testing
