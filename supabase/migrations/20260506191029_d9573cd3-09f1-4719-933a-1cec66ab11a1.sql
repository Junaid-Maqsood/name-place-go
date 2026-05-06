
ALTER TABLE public.game_bans ADD COLUMN IF NOT EXISTS kick_count integer NOT NULL DEFAULT 1;
