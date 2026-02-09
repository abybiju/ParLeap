-- Migration: Add polymorphic setlist items support
-- Allows event_items to contain Songs, Bible references, or Media items
-- Maintains backward compatibility with existing song-only items

-- Make song_id nullable to support non-song items
ALTER TABLE event_items
  ALTER COLUMN song_id DROP NOT NULL;

-- Add new columns to event_items (all nullable for backward compatibility)
ALTER TABLE event_items
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'SONG' CHECK (item_type IN ('SONG', 'BIBLE', 'MEDIA')),
  ADD COLUMN IF NOT EXISTS bible_ref TEXT,
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_title TEXT;

-- Set default type for existing rows
UPDATE event_items SET item_type = 'SONG' WHERE item_type IS NULL;

-- Add constraint: At least one content field must be set based on item_type
ALTER TABLE event_items
  DROP CONSTRAINT IF EXISTS event_items_content_check;

ALTER TABLE event_items
  ADD CONSTRAINT event_items_content_check CHECK (
    (item_type = 'SONG' AND song_id IS NOT NULL) OR
    (item_type = 'BIBLE' AND bible_ref IS NOT NULL) OR
    (item_type = 'MEDIA' AND media_url IS NOT NULL)
  );

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_event_items_type ON event_items(event_id, item_type);

-- Comments for documentation
COMMENT ON COLUMN event_items.item_type IS 'Type of setlist item: SONG, BIBLE, or MEDIA';
COMMENT ON COLUMN event_items.bible_ref IS 'Bible reference string (e.g., "John 3:16-18") for BIBLE type items';
COMMENT ON COLUMN event_items.media_url IS 'URL to media content (image/video) for MEDIA type items';
COMMENT ON COLUMN event_items.media_title IS 'Display title for MEDIA type items';

-- Function to atomically reorder event items
-- This prevents duplicate key violations during reordering
CREATE OR REPLACE FUNCTION reorder_event_items(
  p_event_id UUID,
  p_item_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  temp_offset INT := 10000;
  i INT;
BEGIN
  -- Phase 1: Set all items to unique temporary values
  FOR i IN 1..array_length(p_item_ids, 1) LOOP
    UPDATE event_items
    SET sequence_order = temp_offset + i
    WHERE id = p_item_ids[i]
      AND event_id = p_event_id;
  END LOOP;

  -- Phase 2: Update to final sequence_order values
  FOR i IN 1..array_length(p_item_ids, 1) LOOP
    UPDATE event_items
    SET sequence_order = i
    WHERE id = p_item_ids[i]
      AND event_id = p_event_id;
  END LOOP;
END;
$$;
