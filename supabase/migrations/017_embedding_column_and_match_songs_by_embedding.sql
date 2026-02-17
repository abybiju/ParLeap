-- YouTube-style hum search: add embedding column (768-dim from Wav2Vec2) and match function
-- Optional: when EMBEDDING_SERVICE_URL is set, backend uses this instead of melody_vector

ALTER TABLE song_fingerprints
  ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE INDEX IF NOT EXISTS idx_song_fingerprints_embedding
  ON song_fingerprints
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

CREATE OR REPLACE FUNCTION match_songs_by_embedding(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  song_id UUID,
  title TEXT,
  artist TEXT,
  similarity float,
  lyrics TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sf.id,
    sf.song_id,
    sf.title,
    sf.artist,
    1 - (sf.embedding <=> query_embedding) AS similarity,
    COALESCE(s.lyrics, '')::TEXT AS lyrics
  FROM song_fingerprints sf
  LEFT JOIN songs s ON s.id = sf.song_id
  WHERE sf.embedding IS NOT NULL
    AND 1 - (sf.embedding <=> query_embedding) > match_threshold
  ORDER BY sf.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
