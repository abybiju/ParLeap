-- Extend match_songs to return lyrics (JOIN songs) for Hum-to-Search API
-- Must DROP first because return type (adding lyrics column) is changing
DROP FUNCTION IF EXISTS match_songs(vector(128), double precision, integer);

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
    1 - (sf.melody_vector <=> query_vector) AS similarity,
    COALESCE(s.lyrics, '')::TEXT AS lyrics
  FROM song_fingerprints sf
  LEFT JOIN songs s ON s.id = sf.song_id
  WHERE 1 - (sf.melody_vector <=> query_vector) > match_threshold
  ORDER BY sf.melody_vector <=> query_vector
  LIMIT match_count;
END;
$$;
