# Migration Cheat-Sheet

Quick reference when writing `supabase/migrations/NNN_*.sql`. Read this before adding a new table.

## Next migration number

Last applied: `025_add_pitch_contour_columns.sql`. Next file: `026_*.sql`.

## The pattern for any new `public` table

After **October 30, 2026**, Supabase no longer auto-grants Data API access to tables in `public`. New tables must be granted explicitly or the frontend (`@supabase/supabase-js`, PostgREST, GraphQL) cannot reach them — they'll silently return empty/404. The backend (`SUPABASE_SERVICE_ROLE_KEY`) is unaffected because `service_role` bypasses these grants.

Template every new table migration like this:

```sql
-- 026_add_example_table.sql

CREATE TABLE public.example (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  -- ...
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_example_user_id ON public.example(user_id);

-- 1. Data API grants (required for frontend access from Oct 30, 2026 onward)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.example TO authenticated;
GRANT SELECT                          ON public.example TO anon;  -- only if unauthenticated reads are needed

-- 2. RLS — controls which rows each role can see/touch
ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own example"
  ON public.example FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own example"
  ON public.example FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- (UPDATE / DELETE policies as needed)
```

## Grants vs RLS — they're not the same thing

| Layer | Controls | Without it |
|---|---|---|
| `GRANT` | *Whether* a role can see the table at all via the Data API | Frontend gets empty results / 404, regardless of RLS |
| `RLS` policy | *Which rows* a role can read/write | Either nothing visible (when enabled with no policy) or everything (when disabled) |

You need **both**. A table with RLS policies but no grants is invisible to the frontend after Oct 30, 2026.

## Role quick-reference

- `anon` — unauthenticated requests (public reads)
- `authenticated` — logged-in users (default frontend role after sign-in)
- `service_role` — backend only; bypasses RLS, has all grants automatically

Only grant the minimum verbs each role needs. Default to `authenticated`-only; add `anon` only when truly public.

## Sequences

If the table uses `SERIAL` / `BIGSERIAL` (we mostly use UUIDs, so usually n/a):

```sql
GRANT USAGE, SELECT ON SEQUENCE public.example_id_seq TO authenticated;
```

## Functions called from the frontend

RPCs invoked via `supabase.rpc('fn_name', ...)` also need execute grants:

```sql
GRANT EXECUTE ON FUNCTION public.fn_name(...) TO authenticated;
```

(See `017_embedding_column_and_match_songs_by_embedding.sql` for an existing example.)

## Storage buckets

Bucket policies live in `storage.objects` — they already use `authenticated`/`anon` and aren't affected by this change. Keep using the pattern in `005_setup_avatar_storage.sql` etc.

## Verifying what's exposed

In the Supabase dashboard → **Security Advisor** → review tables exposed to the Data API. Anything surprising should be revoked:

```sql
REVOKE ALL ON public.surprise_table FROM anon, authenticated;
```

## Background

Supabase changelog: new projects from **2026-05-30**, existing projects from **2026-10-30**. Until those dates, default grants are implicit.
