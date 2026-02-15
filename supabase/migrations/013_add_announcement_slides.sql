-- Migration: Add announcement slide type to event_items
-- ANNOUNCEMENT items have multiple slides (images/video) stored as JSONB array.
-- Each slide: { "url": "...", "type": "image"|"video", "title"?: "..." }

-- Drop existing item_type check (name may vary; try common name first)
DO $$
DECLARE
  conname text;
BEGIN
  FOR conname IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'event_items' AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%item_type%'
  LOOP
    EXECUTE format('ALTER TABLE event_items DROP CONSTRAINT IF EXISTS %I', conname);
  END LOOP;
END $$;

ALTER TABLE event_items
  ADD CONSTRAINT event_items_item_type_check
  CHECK (item_type IN ('SONG', 'BIBLE', 'MEDIA', 'ANNOUNCEMENT'));

-- Add announcement_slides column: array of { url, type, title? }
ALTER TABLE event_items
  ADD COLUMN IF NOT EXISTS announcement_slides JSONB DEFAULT NULL;

COMMENT ON COLUMN event_items.announcement_slides IS 'For ANNOUNCEMENT items: array of { "url": string, "type": "image"|"video", "title"?: string }';

-- Update content check to include ANNOUNCEMENT
ALTER TABLE event_items
  DROP CONSTRAINT IF EXISTS event_items_content_check;

ALTER TABLE event_items
  ADD CONSTRAINT event_items_content_check CHECK (
    (item_type = 'SONG' AND song_id IS NOT NULL) OR
    (item_type = 'BIBLE' AND bible_ref IS NOT NULL) OR
    (item_type = 'MEDIA' AND media_url IS NOT NULL) OR
    (item_type = 'ANNOUNCEMENT' AND announcement_slides IS NOT NULL AND jsonb_array_length(announcement_slides) > 0)
  );
