
-- Admin OTP storage
CREATE TABLE IF NOT EXISTS public.admin_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_otps ENABLE ROW LEVEL SECURITY;
-- No public policies: only service role accesses this table.

-- Game audit log
CREATE TABLE IF NOT EXISTS public.game_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  event text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open read audit" ON public.game_audit_log FOR SELECT USING (true);
CREATE POLICY "open insert audit" ON public.game_audit_log FOR INSERT WITH CHECK (true);

-- Force-ended flag for games
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS ended_by_admin boolean NOT NULL DEFAULT false;

-- Allow 'ended' as a status string (status is text, no constraint to alter)
