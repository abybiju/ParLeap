-- Supabase security advisor fixes:
-- 1) Critical: security definer view
-- 2) Function search_path mutable warnings
-- 3) Extension in public (best effort move to extensions schema)

-- 1) Critical: make view execute with caller permissions
ALTER VIEW IF EXISTS public.template_stats
  SET (security_invoker = true);

-- 2) Harden function search_path (fully-qualify references + fixed path)

-- Trigger helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Community template usage helper
CREATE OR REPLACE FUNCTION public.increment_template_usage(tmpl_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.community_templates
  SET usage_count = usage_count + 1,
      last_used_at = NOW()
  WHERE id = tmpl_id;
END;
$$;

-- Melody-vector match function
CREATE OR REPLACE FUNCTION public.match_songs(
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
SET search_path = pg_catalog, public
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
  FROM public.song_fingerprints sf
  LEFT JOIN public.songs s ON s.id = sf.song_id
  WHERE 1 - (sf.melody_vector <=> query_vector) > match_threshold
  ORDER BY sf.melody_vector <=> query_vector
  LIMIT match_count;
END;
$$;

-- Embedding match function
CREATE OR REPLACE FUNCTION public.match_songs_by_embedding(
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
SET search_path = pg_catalog, public
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
  FROM public.song_fingerprints sf
  LEFT JOIN public.songs s ON s.id = sf.song_id
  WHERE sf.embedding IS NOT NULL
    AND 1 - (sf.embedding <=> query_embedding) > match_threshold
  ORDER BY sf.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 3) Extension in public: move vector to extensions schema when possible
-- This is best-effort because some managed projects may block extension relocation.
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector'
      AND n.nspname = 'public'
  ) THEN
    BEGIN
      ALTER EXTENSION vector SET SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not move extension "vector" to schema "extensions": %', SQLERRM;
    END;
  END IF;
END $$;

