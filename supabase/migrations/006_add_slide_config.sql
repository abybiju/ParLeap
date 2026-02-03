-- Add slide configuration columns for multi-line projection
-- Migration: 006_add_slide_config.sql
--
-- Adds slide_config to songs (default formatting) and slide_config_override
-- to event_items (per-event overrides). Both use JSONB for flexibility.

-- Add slide_config to songs table
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS slide_config JSONB DEFAULT '{}'::jsonb;

-- Add slide_config_override to event_items table
ALTER TABLE event_items 
ADD COLUMN IF NOT EXISTS slide_config_override JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN songs.slide_config IS 'Default slide formatting config (linesPerSlide, respectStanzaBreaks, manualBreaks)';
COMMENT ON COLUMN event_items.slide_config_override IS 'Per-event override for slide formatting (merges with song default)';

-- RLS policies already cover these columns since they're on existing tables
-- The existing policies check user_id ownership, so slide_config fields are
-- automatically protected by the same RLS rules.
