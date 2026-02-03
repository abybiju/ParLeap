# Avatar Column Migration Setup

## Issue
If you see the error: `Could not find the 'avatar' column of 'profiles' in the schema cache`, it means the migration hasn't been applied to your Supabase database.

## Solution

### Step 1: Apply the Migration in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Create a new query and paste the following SQL:

```sql
-- Add avatar column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.avatar IS 'Avatar preset ID or custom avatar URL';
```

5. Click **Run** to execute the migration

### Step 2: Verify the Migration

After running the migration, verify it was applied:

1. Go to **Table Editor** in Supabase Dashboard
2. Select the `profiles` table
3. Check that the `avatar` column exists (it should be of type `text` and nullable)

### Step 3: Clear Schema Cache (if needed)

If the error persists after applying the migration:

1. The Supabase client should automatically refresh, but you can:
   - Refresh your browser
   - Clear browser cache
   - Wait a few seconds for the schema cache to update

### Step 4: Set Up Storage Bucket (for uploads)

To enable avatar uploads from device:

1. Go to **Storage** in Supabase Dashboard
2. Click **Create new bucket**
3. Name it: `avatars`
4. Set it to **Public**
5. Go to **SQL Editor** and run the policies from `supabase/migrations/005_setup_avatar_storage.sql`:

```sql
-- Users can upload their own avatars
CREATE POLICY IF NOT EXISTS "Users can upload own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own avatars
CREATE POLICY IF NOT EXISTS "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own avatars
CREATE POLICY IF NOT EXISTS "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Public read access for all avatars
CREATE POLICY IF NOT EXISTS "Public avatar access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```

## Migration Files

- `supabase/migrations/004_add_avatar_to_profiles.sql` - Adds avatar column
- `supabase/migrations/005_setup_avatar_storage.sql` - Sets up storage policies

## Notes

- The `avatar` column stores either:
  - Preset IDs (e.g., `rocket`, `preset:astronaut-helmet`)
  - Full URLs (e.g., `https://...` for uploaded images)
- Preset avatars work immediately after applying migration 004
- Upload functionality requires both migrations and the storage bucket setup
