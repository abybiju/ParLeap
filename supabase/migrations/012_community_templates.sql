-- Community formatting templates (structure-only, no lyrics)

-- Enum for template status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_template_status') THEN
    CREATE TYPE community_template_status AS ENUM ('pending', 'active', 'flagged');
  END IF;
END $$;

-- Main templates table
CREATE TABLE IF NOT EXISTS public.community_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccli_number TEXT NOT NULL,
  line_count INT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  lines_per_slide INT,
  source_version TEXT,
  structure_hash TEXT NOT NULL,
  status community_template_status NOT NULL DEFAULT 'active',
  usage_count INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.community_templates IS 'Structure-only community formatting for songs; no lyrics stored.';

-- Uniqueness: one entry per ccli + structure hash
CREATE UNIQUE INDEX IF NOT EXISTS community_templates_ccli_hash_idx
  ON public.community_templates(ccli_number, structure_hash);

CREATE INDEX IF NOT EXISTS community_templates_ccli_idx
  ON public.community_templates(ccli_number);

-- Votes table
CREATE TABLE IF NOT EXISTS public.template_votes (
  template_id UUID REFERENCES public.community_templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (template_id, user_id)
);

-- View for scores/usage
CREATE OR REPLACE VIEW public.template_stats AS
SELECT
  t.id AS template_id,
  t.ccli_number,
  t.line_count,
  t.sections,
  t.slides,
  t.lines_per_slide,
  t.source_version,
  t.status,
  t.usage_count,
  t.last_used_at,
  t.created_at,
  t.created_by,
  COALESCE(SUM(v.vote), 0) AS score,
  COALESCE(SUM(CASE WHEN v.vote = 1 THEN 1 ELSE 0 END), 0) AS upvotes,
  COALESCE(SUM(CASE WHEN v.vote = -1 THEN 1 ELSE 0 END), 0) AS downvotes
FROM public.community_templates t
LEFT JOIN public.template_votes v ON v.template_id = t.id
GROUP BY t.id;

-- RLS
ALTER TABLE public.community_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies (PostgreSQL doesn't support IF NOT EXISTS for policies; drop if present then create)
DROP POLICY IF EXISTS community_templates_select ON public.community_templates;
CREATE POLICY community_templates_select ON public.community_templates
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS template_votes_select ON public.template_votes;
CREATE POLICY template_votes_select ON public.template_votes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS community_templates_insert ON public.community_templates;
CREATE POLICY community_templates_insert ON public.community_templates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS template_votes_insert ON public.template_votes;
CREATE POLICY template_votes_insert ON public.template_votes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS community_templates_update_owner ON public.community_templates;
CREATE POLICY community_templates_update_owner ON public.community_templates
  FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS community_templates_delete_owner ON public.community_templates;
CREATE POLICY community_templates_delete_owner ON public.community_templates
  FOR DELETE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS template_votes_update_owner ON public.template_votes;
CREATE POLICY template_votes_update_owner ON public.template_votes
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS template_votes_delete_owner ON public.template_votes;
CREATE POLICY template_votes_delete_owner ON public.template_votes
  FOR DELETE USING (auth.uid() = user_id);

-- Usage increment helper
CREATE OR REPLACE FUNCTION public.increment_template_usage(tmpl_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.community_templates
  SET usage_count = usage_count + 1,
      last_used_at = NOW()
  WHERE id = tmpl_id;
END;
$$;
