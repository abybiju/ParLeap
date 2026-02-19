-- Event backgrounds storage bucket (images/videos for projector background).
-- Create bucket manually in Supabase Dashboard: Storage → New bucket 'event-backgrounds', Public.
-- Then run these policies.

DROP POLICY IF EXISTS "Users can upload own event backgrounds" ON storage.objects;
CREATE POLICY "Users can upload own event backgrounds"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-backgrounds'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own event backgrounds" ON storage.objects;
CREATE POLICY "Users can update own event backgrounds"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'event-backgrounds'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own event backgrounds" ON storage.objects;
CREATE POLICY "Users can delete own event backgrounds"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'event-backgrounds'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Public event backgrounds read" ON storage.objects;
CREATE POLICY "Public event backgrounds read"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-backgrounds');
