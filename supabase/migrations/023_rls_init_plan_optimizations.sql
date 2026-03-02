-- Optimize RLS policy expressions to avoid repeated auth function re-evaluation.
-- This keeps behavior the same, but uses the recommended `(select auth.uid())`
-- / `(select auth.role())` pattern for better planner behavior.

-- Helpful indexes for owner checks used in RLS policies
CREATE INDEX IF NOT EXISTS idx_community_templates_created_by
  ON public.community_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_template_votes_user_id
  ON public.template_votes(user_id);

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

-- Songs
DROP POLICY IF EXISTS "Users can view own songs" ON public.songs;
CREATE POLICY "Users can view own songs"
  ON public.songs
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own songs" ON public.songs;
CREATE POLICY "Users can insert own songs"
  ON public.songs
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own songs" ON public.songs;
CREATE POLICY "Users can update own songs"
  ON public.songs
  FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own songs" ON public.songs;
CREATE POLICY "Users can delete own songs"
  ON public.songs
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Events
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
CREATE POLICY "Users can view own events"
  ON public.events
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own events" ON public.events;
CREATE POLICY "Users can insert own events"
  ON public.events
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own events" ON public.events;
CREATE POLICY "Users can update own events"
  ON public.events
  FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own events" ON public.events;
CREATE POLICY "Users can delete own events"
  ON public.events
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Event items
DROP POLICY IF EXISTS "Users can view own event items" ON public.event_items;
CREATE POLICY "Users can view own event items"
  ON public.event_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_items.event_id
        AND e.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own event items" ON public.event_items;
CREATE POLICY "Users can insert own event items"
  ON public.event_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_items.event_id
        AND e.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own event items" ON public.event_items;
CREATE POLICY "Users can update own event items"
  ON public.event_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_items.event_id
        AND e.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own event items" ON public.event_items;
CREATE POLICY "Users can delete own event items"
  ON public.event_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_items.event_id
        AND e.user_id = (select auth.uid())
    )
  );

-- Community templates
DROP POLICY IF EXISTS community_templates_select ON public.community_templates;
CREATE POLICY community_templates_select
  ON public.community_templates
  FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS community_templates_insert ON public.community_templates;
CREATE POLICY community_templates_insert
  ON public.community_templates
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS community_templates_update_owner ON public.community_templates;
CREATE POLICY community_templates_update_owner
  ON public.community_templates
  FOR UPDATE
  USING ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS community_templates_delete_owner ON public.community_templates;
CREATE POLICY community_templates_delete_owner
  ON public.community_templates
  FOR DELETE
  USING ((select auth.uid()) = created_by);

-- Template votes
DROP POLICY IF EXISTS template_votes_select ON public.template_votes;
CREATE POLICY template_votes_select
  ON public.template_votes
  FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS template_votes_insert ON public.template_votes;
CREATE POLICY template_votes_insert
  ON public.template_votes
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS template_votes_update_owner ON public.template_votes;
CREATE POLICY template_votes_update_owner
  ON public.template_votes
  FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS template_votes_delete_owner ON public.template_votes;
CREATE POLICY template_votes_delete_owner
  ON public.template_votes
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Bible versions
DROP POLICY IF EXISTS "Bible versions are readable by authenticated users" ON public.bible_versions;
CREATE POLICY "Bible versions are readable by authenticated users"
  ON public.bible_versions
  FOR SELECT
  USING ((select auth.role()) = 'authenticated');

