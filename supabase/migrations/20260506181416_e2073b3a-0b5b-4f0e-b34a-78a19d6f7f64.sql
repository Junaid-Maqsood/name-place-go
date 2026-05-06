
-- Games table
CREATE TABLE public.games (
  id TEXT PRIMARY KEY,
  host_player_id UUID,
  status TEXT NOT NULL DEFAULT 'lobby',
  num_rounds INT NOT NULL DEFAULT 5,
  round_seconds INT NOT NULL DEFAULT 90,
  finish_countdown INT NOT NULL DEFAULT 15,
  categories TEXT[] NOT NULL DEFAULT ARRAY['Name','Place','Animal','Thing','Food','Movie'],
  current_round INT NOT NULL DEFAULT 0,
  current_letter TEXT,
  round_started_at TIMESTAMPTZ,
  finish_triggered_at TIMESTAMPTZ,
  used_letters TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎮',
  score INT NOT NULL DEFAULT 0,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  finished_round BOOLEAN NOT NULL DEFAULT false,
  connected BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_players_game ON public.players(game_id);

CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round INT NOT NULL,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, round, player_id, category)
);
CREATE INDEX idx_answers_round ON public.answers(game_id, round);

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_game ON public.chat_messages(game_id, created_at);

-- RLS open (anonymous lobby game). Game code = access control.
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all games" ON public.games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all players" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all answers" ON public.answers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all chat" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.answers REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
