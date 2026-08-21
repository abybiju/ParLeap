-- 026_bible_projection_log.sql
-- Session log for Smart Bible Listen: every verse that was projected (or detected-but-held)
-- during a live session, with how it got there and how confident the engine was.
-- Powers the operator history panel, post-service review, and serves as a detection eval dataset.

CREATE TABLE public.bible_projection_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  end_verse INTEGER,
  version_abbrev TEXT,
  -- spoken | content | follow | manual | undo | setlist
  source TEXT NOT NULL,
  confidence REAL,
  -- false when HOLD was on and the detection was queued instead of projected
  projected BOOLEAN NOT NULL DEFAULT TRUE,
  -- last transcript fragment that led to this entry (for eval / debugging)
  transcript_snippet TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_bible_projection_log_event_created ON public.bible_projection_log(event_id, created_at DESC);
CREATE INDEX idx_bible_projection_log_user_id ON public.bible_projection_log(user_id);

-- 1. Data API grants (required for frontend access from Oct 30, 2026 onward)
GRANT SELECT, DELETE ON public.bible_projection_log TO authenticated;
-- Inserts come from the backend (service_role), which bypasses grants and RLS.

-- 2. RLS
ALTER TABLE public.bible_projection_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bible projection log"
  ON public.bible_projection_log FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own bible projection log"
  ON public.bible_projection_log FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
