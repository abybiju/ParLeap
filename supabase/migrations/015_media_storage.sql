-- Media assets storage bucket (images/videos for setlist MEDIA items).
-- Create bucket manually in Supabase Dashboard: Storage → New bucket 'media-assets', Public.
-- Then run these policies.
-- Note: CREATE POLICY does not support IF NOT EXISTS; we drop first for idempotency.

DROP POLICY IF EXISTS "Users can upload own media assets" ON storage.objects;
CREATE POLICY "Users can upload own media assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'media-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own media assets" ON storage.objects;
CREATE POLICY "Users can update own media assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'media-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own media assets" ON storage.objects;
CREATE POLICY "Users can delete own media assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'media-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Public media assets read" ON storage.objects;
CREATE POLICY "Public media assets read"
ON storage.objects FOR SELECT
USING (bucket_id = 'media-assets');
