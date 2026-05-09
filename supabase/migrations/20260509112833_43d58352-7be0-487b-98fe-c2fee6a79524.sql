
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS voice_muted boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS host_muted boolean NOT NULL DEFAULT false;
