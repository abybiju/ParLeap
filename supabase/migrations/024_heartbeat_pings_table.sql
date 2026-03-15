-- Create heartbeat table that GitHub Actions can write to keep the project active
CREATE TABLE IF NOT EXISTS public.heartbeat_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'github-actions'
);

-- Allow service_role to insert (service role already bypasses RLS, so no policy needed)
