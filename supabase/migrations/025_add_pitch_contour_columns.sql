-- Add pitch contour and interval sequence columns for CREPE-based hum search.
-- These store variable-length arrays (not pgvector) for DTW matching.

ALTER TABLE song_fingerprints
  ADD COLUMN IF NOT EXISTS pitch_contour float8[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interval_sequence float8[] DEFAULT NULL;

-- Add a comment explaining the new columns
COMMENT ON COLUMN song_fingerprints.pitch_contour IS 'CREPE F0 pitch values in Hz at 10ms intervals. 0.0 = unvoiced frame.';
COMMENT ON COLUMN song_fingerprints.interval_sequence IS 'Semitone deltas between consecutive voiced frames. Key-invariant melody representation.';
