# Supabase Setup Guide

## Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name**: ParLeap
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait for project to be created (~2 minutes)

### 2. Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...` (for frontend)
   - **service_role key**: `eyJhbGc...` (for backend - KEEP SECRET!)

### 3. Run Database Migrations

**Option A: Using Supabase Dashboard (Easiest)**

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy the contents of `migrations/001_initial_schema.sql`
3. Paste and click **Run**

**Option B: Using Supabase CLI**

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### 4. Configure Authentication Providers

1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Enable **Email** provider (already enabled by default)
3. Optional: Enable **Google OAuth**:
   - Toggle Google provider
   - Add OAuth credentials from Google Cloud Console
   - Configure redirect URLs

### 5. Verify Setup

Run this query in SQL Editor to verify tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

You should see: `profiles`, `songs`, `events`, `event_items`

### 6. Set Up Environment Variables

Copy the API keys to your environment files:

**Frontend** (`/frontend/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

**Backend** (`/backend/.env`):
```env
PORT=3001
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
NODE_ENV=development
```

## Database Schema Overview

### Tables

1. **profiles** - User profiles with subscription tiers
2. **songs** - Content library (lyrics, titles, artists)
3. **events** - Live events/services
4. **event_items** - Setlists (ordered songs for events)

### Security

- **Row Level Security (RLS)** is enabled on all tables
- Users can only access their own data
- Service role bypasses RLS (use carefully in backend)

## Troubleshooting

### Issue: Migration fails with "relation already exists"

**Solution**: Drop existing tables first (WARNING: deletes data):

```sql
DROP TABLE IF EXISTS event_items CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS songs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
```

### Issue: RLS prevents data access

**Solution**: Verify user is authenticated and policies are correct. Test with:

```sql
-- Check current user
SELECT auth.uid();

-- Temporarily disable RLS for testing (re-enable after!)
ALTER TABLE songs DISABLE ROW LEVEL SECURITY;
```

### Issue: Can't connect from backend

**Solution**: Verify you're using the `service_role` key, not the `anon` key.

## Next Steps

After setup is complete:

1. ✅ Database tables created
2. ✅ RLS policies active
3. ✅ Environment variables configured
4. ⏭️ Implement Supabase clients (frontend & backend)
5. ⏭️ Build authentication flow
