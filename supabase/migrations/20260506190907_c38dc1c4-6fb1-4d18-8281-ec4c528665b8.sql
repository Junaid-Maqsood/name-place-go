
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium';

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS kick_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.game_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  nickname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, nickname)
);

ALTER TABLE public.game_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all bans" ON public.game_bans FOR ALL USING (true) WITH CHECK (true);
