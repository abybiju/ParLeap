-- Setup Avatar Storage Bucket and RLS Policies
-- Migration: 005_setup_avatar_storage.sql
-- 
-- Note: This migration documents the required storage setup.
-- The bucket must be created manually in Supabase Dashboard:
-- 1. Go to Storage → Create new bucket: 'avatars'
-- 2. Set bucket to Public
-- 3. Then run the policies below

-- RLS Policies for Avatar Storage
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
