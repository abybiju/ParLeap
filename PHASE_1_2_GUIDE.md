# Phase 1.2: Supabase Integration - Complete Setup Guide

**Status**: Ready for Implementation  
**Date**: December 14, 2025  
**Estimated Time**: 2-3 hours

---

## 📋 Overview

Phase 1.2 integrates Supabase as our real data source, replacing mock data throughout the application. This is a critical foundation for all downstream features.

### What's Implemented

✅ **Database Schema** - Complete PostgreSQL schema with RLS policies  
✅ **Backend Event Service** - `eventService.ts` for Supabase queries  
✅ **WebSocket Integration** - Real data fetching in `handleStartSession`  
✅ **Database Seed Script** - Helper to populate test data  
✅ **Type Safety** - Full TypeScript support with no `any` types  

---

## 🚀 Quick Start (5 minutes)

### Step 1: Set Up Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
   - Name: `ParLeap`
   - Choose a region close to you
   - Save your database password securely

2. Wait for the project to be created (~2 minutes)

### Step 2: Run Database Migration

1. In Supabase dashboard, go to **SQL Editor** → **New Query**
2. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
3. Paste into the SQL editor and click **Run**
4. Verify you see success messages for all tables

### Step 3: Configure Environment Variables

Create `/backend/.env` with your Supabase credentials:

```env
PORT=3001
NODE_ENV=development

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

CORS_ORIGIN=http://localhost:3000
```

To get your keys:
1. In Supabase dashboard: **Settings** → **API**
2. Copy **Project URL** → `SUPABASE_URL`
3. Copy **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

Also create `/frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### Step 4: Seed Test Data

```bash
# From the backend directory
cd backend
npm install  # If not already done
npx ts-node src/utils/seedDatabase.ts
```

This creates:
- Test user (email: `test@parleap.local`)
- 3 sample songs (Amazing Grace, How Great Thou Art, Jesus Loves Me)
- 1 test event with all songs in the setlist

### Step 5: Test the Integration

1. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Visit `http://localhost:3000/test-websocket`

4. Copy the **Event ID** from the seed output and paste it

5. Click **"Start Session"**

✅ **Success**: You should see the event name and setlist loaded from Supabase!

---

## 🏗️ Architecture Overview

### Data Flow: Session Start

```
Frontend (WebSocket)
    ↓
Backend (handleStartSession)
    ↓
eventService.fetchEventData()
    ↓
Supabase (events + event_items + songs)
    ↓
Parse lyrics into lines
    ↓
Cache in SessionState
    ↓
Send SESSION_STARTED to frontend
```

### Database Schema

```
profiles (User profiles)
    ↑
    ├─ songs (User's song library)
    │     ↑
    │     └─ event_items
    │           ↑
    │           └─ events (User's events)

RLS: Each user can only see their own data
```

---

## 📝 Implementation Details

### 1. Backend Event Service

**File**: `backend/src/services/eventService.ts`

Key functions:
- `fetchEventData(eventId)` - Main function to fetch event with all songs
- `fetchSongById(songId)` - Fetch a single song
- `createSong()` - Create new song
- `createEvent()` - Create new event
- `addSongToEvent()` - Add song to setlist

**Error Handling**: All functions return `null` on error (no exceptions thrown)

**Lyric Parsing**: 
```typescript
parseLyrics(lyrics) → string[]
// Splits by newline, filters empty lines
// Example: "Line 1\nLine 2\n\nLine 3" → ["Line 1", "Line 2", "Line 3"]
```

### 2. Updated WebSocket Handler

**File**: `backend/src/websocket/handler.ts`

Changes:
- Imports `fetchEventData` from eventService
- `handleStartSession()` now:
  1. Calls `fetchEventData(eventId)` instead of using mock data
  2. Returns error if event not found or has empty setlist
  3. Parses lyrics into lines automatically
  4. Caches data in SessionState

### 3. Database Seed Script

**File**: `backend/src/utils/seedDatabase.ts`

Usage:
```bash
npx ts-node src/utils/seedDatabase.ts
```

Creates:
1. Auth user (test@parleap.local)
2. User profile
3. 3 sample songs
4. 1 event with setlist

Output shows the Event ID needed for testing.

---

## 🧪 Testing Checklist

### Test 1: Database Schema ✅
- [ ] All tables created in Supabase
- [ ] RLS policies active
- [ ] Indexes created
- [ ] Triggers working (updated_at timestamp)

**Verify**: In Supabase, go to **Table Editor**
- See: `profiles`, `songs`, `events`, `event_items`
- Each table has RLS policies (green lock icon)

### Test 2: Seed Script ✅
- [ ] Test user created
- [ ] Songs inserted
- [ ] Event created
- [ ] Setlist populated

**Verify**: 
```bash
npx ts-node src/utils/seedDatabase.ts
# Should see: "🎉 Database seed complete!"
```

### Test 3: Backend Event Fetching ✅
- [ ] Backend can read from Supabase
- [ ] `fetchEventData()` returns data
- [ ] Lyrics parsed into lines
- [ ] No console errors

**Verify**:
```bash
npm run dev
# Watch console for: "[EventService] Error fetching event data"
# Should NOT appear
```

### Test 4: WebSocket Integration ✅
- [ ] Frontend connects to backend
- [ ] START_SESSION message triggers Supabase fetch
- [ ] SESSION_STARTED includes real setlist
- [ ] First slide displays correct lyric line

**Verify**: In test-websocket page:
- Session started message shows correct event name
- Setlist shows all 3 songs
- First lyric line displays

### Test 5: Latency ✅
- [ ] Session start takes < 500ms
- [ ] Check timing metadata in response

**Verify**: Open browser DevTools → Network → Messages
- See `SESSION_STARTED` with timing metadata

---

## 🐛 Troubleshooting

### Error: "SUPABASE_URL not set"
**Solution**: Make sure `.env` file exists in backend directory with all variables

### Error: "Event not found"
**Solution**: 
1. Run seed script: `npx ts-node src/utils/seedDatabase.ts`
2. Copy the Event ID from output
3. Use that ID in the WebSocket test

### Error: "Event has no songs in setlist"
**Solution**: 
1. Verify seed script completed successfully
2. In Supabase, check `event_items` table has records
3. Re-run seed script

### Supabase Tables Don't Exist
**Solution**:
1. Go to Supabase **SQL Editor** → **New Query**
2. Copy entire `supabase/migrations/001_initial_schema.sql`
3. Paste and click **Run**
4. Wait for all queries to complete

### WebSocket Says "RLS Violation"
**Solution**:
1. Check that you're using `service_role` key (not `anon` key) in backend
2. The seed script must complete successfully first
3. Verify RLS policies are created (run migration again)

---

## 📊 Success Metrics

Phase 1.2 is complete when:

✅ Supabase project created with all tables  
✅ Database migration runs without errors  
✅ Seed script creates test data  
✅ Backend fetches real event data from Supabase  
✅ WebSocket integration shows real setlist  
✅ Latency < 500ms for session start  
✅ No RLS violations or database errors  

---

## 🔄 Integration with Other Phases

### Needed By:
- **Phase 2.3 (Audio Capture)**: Will use this setlist to stream audio
- **Phase 2.4 (STT Integration)**: Will transcribe against these song lines
- **Phase 3 (Matching Engine)**: Will match against this data

### Depends On:
- Supabase project setup (manual)
- Database migration (manual in SQL Editor)
- Environment variables (manual setup)

---

## 📝 Next Steps

After Phase 1.2 is complete:

1. **Phase 2.3**: Audio Capture
   - Browser microphone access
   - Audio streaming to WebSocket
   - Visual feedback UI

2. **Phase 2.4**: STT Integration
   - Choose provider (Google/ElevenLabs)
   - Stream audio for transcription

3. **Phase 3**: Matching Engine
   - Fuzzy string matching
   - Auto-advance logic

---

## 🔐 Security Notes

**Environment Variables**:
- `SUPABASE_SERVICE_ROLE_KEY` - NEVER commit to git or share
- Use different keys for frontend (anon) and backend (service_role)
- Supabase RLS protects against unauthorized access

**RLS Policies**:
- Each user can only see their own songs, events, and setlists
- Enforced at database level (not just application level)

**Testing**:
- Seed script creates a test user
- In production, real users create their own events
- Never share test credentials

---

## 📚 Files Modified

| File | Changes |
|------|---------|
| `backend/src/websocket/handler.ts` | Import eventService, fetch real data |
| `backend/src/services/eventService.ts` | NEW - Supabase queries |
| `backend/src/utils/seedDatabase.ts` | NEW - Test data seeding |
| `supabase/migrations/001_initial_schema.sql` | Schema + RLS (already exists) |

---

## ✅ Verification Commands

```bash
# Check that backend can connect to Supabase
npm run dev  # in backend, watch for connection logs

# Test the seed script
npx ts-node src/utils/seedDatabase.ts

# Test WebSocket in browser
# 1. Start backend and frontend
# 2. Visit http://localhost:3000/test-websocket
# 3. Enter event ID and click "Start Session"
```

---

**Questions?** Check the implementation files:
- `backend/src/services/eventService.ts` - How to query Supabase
- `backend/src/websocket/handler.ts` - How it's integrated
- `supabase/migrations/001_initial_schema.sql` - Database structure

**Ready to move to Phase 2.3?** Once this phase is complete, we'll add audio capture.

