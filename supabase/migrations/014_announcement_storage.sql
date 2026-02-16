-- Announcement assets storage bucket (images/videos for announcement slides).
-- Create bucket manually in Supabase Dashboard: Storage → New bucket 'announcement-assets', Public.
-- Then run these policies.
-- Note: CREATE POLICY does not support IF NOT EXISTS; we drop first for idempotency.

DROP POLICY IF EXISTS "Users can upload own announcement assets" ON storage.objects;
CREATE POLICY "Users can upload own announcement assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'announcement-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own announcement assets" ON storage.objects;
CREATE POLICY "Users can update own announcement assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'announcement-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own announcement assets" ON storage.objects;
CREATE POLICY "Users can delete own announcement assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'announcement-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Public announcement assets read" ON storage.objects;
CREATE POLICY "Public announcement assets read"
ON storage.objects FOR SELECT
USING (bucket_id = 'announcement-assets');
