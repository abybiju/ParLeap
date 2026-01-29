-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Song fingerprints table (separate from user songs for global search)
CREATE TABLE song_fingerprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  melody_vector vector(128),
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast vector similarity search
CREATE INDEX idx_song_fingerprints_melody ON song_fingerprints 
  USING ivfflat (melody_vector vector_cosine_ops) WITH (lists = 100);

-- Search function using cosine similarity
CREATE OR REPLACE FUNCTION match_songs(
  query_vector vector(128),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  song_id UUID,
  title TEXT,
  artist TEXT,
  similarity float
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
    1 - (sf.melody_vector <=> query_vector) AS similarity
  FROM song_fingerprints sf
  WHERE 1 - (sf.melody_vector <=> query_vector) > match_threshold
  ORDER BY sf.melody_vector <=> query_vector
  LIMIT match_count;
END;
$$;
