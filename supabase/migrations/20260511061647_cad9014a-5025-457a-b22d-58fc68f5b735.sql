
-- Password reset tokens for admin
CREATE TABLE IF NOT EXISTS public.admin_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_password_resets ENABLE ROW LEVEL SECURITY;
-- No public policies; service role only.

-- Admin login attempts (rate limiting + audit)
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  ip text,
  success boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
-- service role only.

CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON public.admin_login_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.admin_login_attempts(email, created_at DESC);

-- Global error logs (frontend + backend reports)
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'frontend',
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  stack text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  game_id text,
  player_id uuid,
  url text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open insert error_logs" ON public.error_logs FOR INSERT WITH CHECK (true);
-- read restricted to service role (no select policy)

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON public.error_logs(category, created_at DESC);

-- Admin password storage (hashed). Keeps a single row.
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  id integer PRIMARY KEY DEFAULT 1,
  email text NOT NULL,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_credentials_singleton CHECK (id = 1)
);
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
-- service role only.
