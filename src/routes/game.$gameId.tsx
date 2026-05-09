import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import {
  type Game, type Player, type Answer, type Difficulty, loadSession, saveSession,
  startRound, endRound, nextStep, clearSession, pickRandomEmoji, kickPlayer,
} from "@/lib/game";
import { randomGamertag } from "@/lib/gamertags";
import { sfx, setMuted, isMuted } from "@/lib/sfx";
import { ChatPanel } from "@/components/game/ChatPanel";
import { PlayerList } from "@/components/game/PlayerList";
import { CountdownTimer } from "@/components/game/CountdownTimer";
import { VoiceChat } from "@/components/game/VoiceChat";
import { Copy, Play, Plus, X, LogOut, Trophy, Bot, Settings, Share2, Volume2, VolumeX } from "lucide-react";

export const Route = createFileRoute("/game/$gameId")({ component: GameRoute });

function GameRoute() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [me, setMe] = useState<{ playerId: string; nickname: string; emoji: string } | null>(null);
  const [joining, setJoining] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [emojiInput, setEmojiInput] = useState(pickRandomEmoji());

  // Load session / verify membership
  useEffect(() => {
    (async () => {
      const s = loadSession();
      if (!s || s.gameId !== gameId) { setJoining(true); return; }
      const { data: p } = await supabase.from("players").select("*").eq("id", s.playerId).maybeSingle();
      if (!p) { clearSession(); setJoining(true); return; }
      setMe({ playerId: s.playerId, nickname: s.nickname, emoji: s.emoji });
    })();
  }, [gameId]);

  // Load game + subscribe
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: g } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
      if (!mounted) return;
      if (!g) { toast.error("Game not found"); navigate({ to: "/" }); return; }
      setGame(g as Game);
      const { data: ps } = await supabase.from("players").select("*").eq("game_id", gameId).order("joined_at");
      setPlayers((ps ?? []) as Player[]);
    })();

    const channel = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (p) => setGame(p.new as Game))
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
        async () => {
          const { data: ps } = await supabase.from("players").select("*").eq("game_id", gameId).order("joined_at");
          setPlayers((ps ?? []) as Player[]);
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `game_id=eq.${gameId}` },
        async () => {
          const { data: an } = await supabase.from("answers").select("*").eq("game_id", gameId);
          setAnswers((an ?? []) as Answer[]);
        })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [gameId, navigate]);

  // Whenever round changes, reload answers
  useEffect(() => {
    if (!game) return;
    (async () => {
      const { data: an } = await supabase.from("answers").select("*").eq("game_id", gameId);
      setAnswers((an ?? []) as Answer[]);
    })();
  }, [game?.current_round, game?.status, gameId]);

  // Confetti + fireworks sound when finished
  useEffect(() => {
    if (game?.status === "finished") {
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
      sfx.fireworks();
      setTimeout(() => confetti({ particleCount: 150, spread: 120, origin: { y: 0.5 } }), 600);
    }
  }, [game?.status]);

  // Sounds: round started / scoring (round ended)
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!game) return;
    if (prevStatus.current && prevStatus.current !== game.status) {
      if (game.status === "playing") sfx.start();
      if (game.status === "scoring") sfx.end();
    }
    prevStatus.current = game.status;
  }, [game?.status]);

  // Sound when a player joins the lobby
  const prevPlayerCount = useRef<number>(0);
  useEffect(() => {
    if (game?.status === "lobby" && players.length > prevPlayerCount.current && prevPlayerCount.current > 0) {
      sfx.join();
    }
    prevPlayerCount.current = players.length;
  }, [players.length, game?.status]);

  // Was-I-kicked detector
  useEffect(() => {
    if (!me || !game) return;
    if (players.length > 0 && !players.find(p => p.id === me.playerId)) {
      toast.error("You were removed from the game");
      clearSession();
      navigate({ to: "/" });
    }
  }, [players, me, game, navigate]);

  // Detect admin-ended game and bounce players to home
  useEffect(() => {
    if (!game) return;
    if (game.status === "ended" || (game as any).ended_by_admin) {
      toast.error("This game has been ended by the admin.");
      clearSession();
      const t = setTimeout(() => navigate({ to: "/" }), 1500);
      return () => clearTimeout(t);
    }
  }, [game?.status, (game as any)?.ended_by_admin, navigate]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nicknameInput.trim()) return;
    try {
      const { joinGame } = await import("@/lib/game");
      const { playerId } = await joinGame(gameId, nicknameInput.trim().slice(0, 16), emojiInput);
      setMe({ playerId, nickname: nicknameInput.trim().slice(0, 16), emoji: emojiInput });
      setJoining(false);
      saveSession({ gameId, playerId, nickname: nicknameInput.trim().slice(0, 16), emoji: emojiInput });
    } catch (err: any) { toast.error(err.message); }
  };

  const leave = async () => {
    if (me) await supabase.from("players").delete().eq("id", me.playerId);
    clearSession();
    navigate({ to: "/" });
  };

  if (joining) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleJoin} className="card-pop p-6 max-w-md w-full space-y-4">
          <h2 className="font-display text-2xl font-bold">Join {gameId}</h2>
          <input value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)}
            placeholder="Your nickname" maxLength={16}
            className="w-full rounded-2xl border-3 border-foreground/30 px-4 py-3 font-bold bg-background focus:outline-none focus:border-primary" />
          <button className="w-full btn-pop bg-primary text-primary-foreground py-3">Jump in! {emojiInput}</button>
        </form>
      </main>
    );
  }

  if (!game || !me) return <main className="min-h-screen flex items-center justify-center"><div className="font-display text-xl animate-pulse">Loading…</div></main>;

  const isHost = game.host_player_id === me.playerId;

  const handleKick = async (p: Player) => {
    if (!isHost) return;
    if (!confirm(`Remove ${p.nickname} from the game?`)) return;
    try {
      const res = await kickPlayer(gameId, { id: p.id, nickname: p.nickname, is_bot: p.is_bot });
      toast.success(res.banned ? `${p.nickname} permanently banned` : `${p.nickname} removed`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <main className="min-h-screen p-2 sm:p-3 md:p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-3 sm:mb-4 gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold truncate">NamePlaceGo!</h1>
          <GameCodeChip gameId={gameId} />
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <SoundToggle />
          <button onClick={leave} className="btn-pop bg-card text-foreground px-2.5 sm:px-3 py-2 text-xs sm:text-sm flex items-center gap-1">
            <LogOut className="size-4" /> <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-3 sm:gap-4">
        <section className="space-y-3 sm:space-y-4 min-w-0">
          {game.status === "lobby" && <LobbyView game={game} players={players} isHost={isHost} />}
          {game.status === "playing" && <PlayingView game={game} players={players} answers={answers} me={me} />}
          {game.status === "scoring" && (
            <div className="card-pop p-10 text-center font-display text-2xl">
              <motion.span animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 1 }}>
                🤖
              </motion.span> Validating answers…
            </div>
          )}
          {game.status === "results" && <RoundResults game={game} players={players} answers={answers} isHost={isHost} />}
          {game.status === "finished" && <FinalLeaderboard players={players} gameId={gameId} game={game} isHost={isHost} />}
        </section>

        <aside className="space-y-3 sm:space-y-4">
          <PlayerList players={players} hostId={game.host_player_id} currentPlayerId={me.playerId}
            showFinished={game.status === "playing"}
            canKick={isHost && game.status === "lobby"} onKick={handleKick} />
          <VoiceChat gameId={gameId} me={me} players={players} isHost={isHost} />
          <ChatPanel gameId={gameId} nickname={me.nickname} playerId={me.playerId} />
        </aside>
      </div>
    </main>
  );
}

function SoundToggle() {
  const [m, setM] = useState(isMuted());
  return (
    <button onClick={() => { const n = !m; setMuted(n); setM(n); }}
      className="btn-pop bg-card text-foreground p-2 flex items-center" aria-label="Toggle sound">
      {m ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  );
}

function GameCodeChip({ gameId }: { gameId: string }) {
  const copy = () => {
    const url = `${window.location.origin}/?join=${gameId}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied!");
  };
  return (
    <button onClick={copy} className="mt-1 inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground border-2 border-foreground/20 px-3 py-1 text-sm font-bold">
      <span className="font-display tracking-widest">{gameId}</span>
      <Copy className="size-3.5" />
    </button>
  );
}

// ---------- Lobby ----------
function LobbyView({ game, players, isHost }: { game: Game; players: Player[]; isHost: boolean }) {
  const [rounds, setRounds] = useState<number | "">(game.num_rounds);
  const [seconds, setSeconds] = useState<number | "">(game.round_seconds);
  const [finish, setFinish] = useState<number | "">(game.finish_countdown);
  const [difficulty, setDifficulty] = useState<Difficulty>((game.difficulty as Difficulty) ?? "medium");
  const [cats, setCats] = useState<string[]>(game.categories);
  const [newCat, setNewCat] = useState("");

  const r = typeof rounds === "number" ? rounds : 5;
  const s = typeof seconds === "number" ? seconds : 90;
  const f = typeof finish === "number" ? finish : 15;

  const save = async () => {
    await supabase.from("games").update({
      num_rounds: r, round_seconds: s, finish_countdown: f, categories: cats, difficulty,
    } as any).eq("id", game.id);
    toast.success("Settings saved");
  };

  const addBot = async () => {
    if (players.length >= 10) { toast.error("Lobby is full (10 max)"); return; }
    const used = players.map(p => p.nickname);
    const name = randomGamertag(used);
    const { count } = await supabase.from("players").select("*", { count: "exact", head: true }).eq("game_id", game.id);
    if ((count ?? 0) >= 10) { toast.error("Lobby is full (10 max)"); return; }
    await supabase.from("players").insert({
      game_id: game.id, nickname: name, emoji: pickRandomEmoji(players.map(p => p.emoji)), is_bot: true,
    });
  };

  const start = async () => {
    if (players.length < 1) return toast.error("Need at least 1 player");
    await save();
    await startRound({ ...game, num_rounds: r, round_seconds: s, finish_countdown: f, categories: cats, difficulty });
  };

  return (
    <div className="card-pop p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="text-center">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">Lobby</h2>
        <p className="text-muted-foreground text-sm">Waiting to start · {players.length}/10 players</p>
      </div>

      {isHost ? (
        <>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            <NumberField label="Rounds" value={rounds} setValue={setRounds} min={1} max={20} />
            <NumberField label="Seconds/round" value={seconds} setValue={setSeconds} min={20} max={300} />
            <NumberField label="Final Countdown" value={finish} setValue={setFinish} min={5} max={60} />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-2">Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {(["easy","medium","hard"] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`btn-pop py-2 text-xs sm:text-sm capitalize ${
                    difficulty === d ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
                  }`}>{d}{d === "hard" ? " 🔥" : ""}</button>
              ))}
            </div>
            {difficulty === "hard" && <p className="text-xs text-muted-foreground mt-1">Includes tough letters: Q, U, X, Y, Z</p>}
          </div>

          <div>
            <label className="font-bold mb-2 flex items-center gap-2 text-sm"><Settings className="size-4" /> Categories</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {cats.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground border-2 border-foreground/20 px-3 py-1 text-xs sm:text-sm font-bold">
                  {c}
                  <button onClick={() => setCats(cats.filter(x => x !== c))}><X className="size-3.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Add category…" maxLength={20}
                className="flex-1 min-w-0 rounded-full border-2 border-foreground/20 px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary" />
              <button onClick={() => { if (newCat.trim()) { setCats([...cats, newCat.trim()]); setNewCat(""); } }}
                className="btn-pop bg-accent text-accent-foreground px-3 py-2 text-sm flex items-center gap-1 shrink-0">
                <Plus className="size-4" /> Add
              </button>
            </div>
            {cats.length === 0 && <p className="text-xs text-destructive mt-1">Add at least one category</p>}
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <button onClick={save} className="btn-pop bg-card text-foreground px-3 py-2 text-xs sm:text-sm">Save</button>
            <button onClick={addBot} disabled={players.length >= 10}
              className="btn-pop text-foreground px-3 py-2 text-xs sm:text-sm flex items-center justify-center gap-1"
              style={{ background: "var(--fun-4)" }}>
              <Bot className="size-4" /> Add bot
            </button>
            <button onClick={start} disabled={cats.length === 0}
              className="btn-pop bg-primary text-primary-foreground px-4 py-2 text-sm sm:ml-auto col-span-2 flex items-center justify-center gap-2">
              <Play className="size-4" /> Start game
            </button>
          </div>
        </>
      ) : (
        <div className="text-center text-muted-foreground">Waiting for host to start the game…</div>
      )}
    </div>
  );
}

function NumberField({ label, value, setValue, min, max }:
  { label: string; value: number | ""; setValue: (n: number | "") => void; min: number; max: number }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-bold text-muted-foreground mb-1 truncate">{label}</label>
      <input type="text" inputMode="numeric" pattern="[0-9]*" value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, "");
          if (v === "") { setValue(""); return; }
          const n = parseInt(v, 10);
          setValue(Math.min(max, n));
        }}
        onBlur={() => { if (value === "" || (typeof value === "number" && value < min)) setValue(min); }}
        className="w-full rounded-2xl border-2 border-foreground/20 px-2 py-2 font-bold text-center bg-background focus:outline-none focus:border-primary" />
    </div>
  );
}

// ---------- Playing ----------
function PlayingView({ game, players, answers, me }:
  { game: Game; players: Player[]; answers: Answer[]; me: { playerId: string; nickname: string; emoji: string } }) {
  const myAnswers = answers.filter(a => a.player_id === me.playerId && a.round === game.current_round);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const c of game.categories) o[c] = myAnswers.find(a => a.category === c)?.value ?? "";
    return o;
  });
  // Reset draft when round changes
  const lastRound = useRef(game.current_round);
  useEffect(() => {
    if (lastRound.current !== game.current_round) {
      const o: Record<string, string> = {};
      for (const c of game.categories) o[c] = "";
      setDraft(o);
      lastRound.current = game.current_round;
    }
  }, [game.current_round, game.categories]);

  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const me_player = players.find(p => p.id === me.playerId);
  const isHost = game.host_player_id === me.playerId;

  // Round age guard — prevents stale finished_round flags from ending fresh round
  const roundStartMs = game.round_started_at ? new Date(game.round_started_at).getTime() : 0;
  const roundIsFresh = Date.now() - roundStartMs < 2000;

  // Only count humans as finished if they actually have an answer row for THIS round
  const humans = players.filter(p => !p.is_bot);
  const finishedHumans = humans.filter(p =>
    p.finished_round && answers.some(a => a.player_id === p.id && a.round === game.current_round)
  );
  const allFinished = humans.length > 0 && finishedHumans.length === humans.length;

  // Bot auto-answers when round starts
  useEffect(() => {
    if (!isHost) return;
    const bots = players.filter(p => p.is_bot && !p.finished_round);
    if (bots.length === 0) return;
    const t = setTimeout(async () => {
      for (const bot of bots) {
        const items = game.categories.map(cat => ({
          game_id: game.id, round: game.current_round, player_id: bot.id, category: cat,
          value: botAnswer(cat, game.current_letter ?? "A"),
        }));
        await supabase.from("answers").upsert(items, { onConflict: "game_id,round,player_id,category" });
        await supabase.from("players").update({ finished_round: true }).eq("id", bot.id);
      }
    }, 4000 + Math.random() * 6000);
    return () => clearTimeout(t);
  }, [isHost, game.current_round, game.current_letter, game.id, game.categories, players]);

  const triggerEnd = useCallback(async () => {
    if (!isHost) return;
    if (game.status !== "playing") return;
    await endRound(game);
  }, [isHost, game]);

  // Auto-submit current draft when timer hits zero (even without clicking Done)
  const autoSubmit = useCallback(async () => {
    if (me_player?.finished_round) return;
    const d = draftRef.current;
    const rows = game.categories.map(cat => ({
      game_id: game.id, round: game.current_round, player_id: me.playerId, category: cat, value: d[cat] ?? "",
    }));
    await supabase.from("answers").upsert(rows, { onConflict: "game_id,round,player_id,category" });
    await supabase.from("players").update({ finished_round: true }).eq("id", me.playerId);
  }, [game.id, game.categories, game.current_round, me.playerId, me_player?.finished_round]);

  const onTimerZero = useCallback(async () => {
    await autoSubmit();
    if (isHost) await triggerEnd();
  }, [autoSubmit, isHost, triggerEnd]);

  // Trigger final countdown when ANY player finishes with all categories filled (uses lobby finish_countdown)
  useEffect(() => {
    if (!isHost || game.finish_triggered_at) return;
    if (roundIsFresh) return;
    const finisher = players.find(p => p.finished_round);
    if (!finisher || allFinished) return;
    const theirAnswers = answers.filter(a => a.player_id === finisher.id && a.round === game.current_round);
    const filled = game.categories.every(c => {
      const a = theirAnswers.find(x => x.category === c);
      return a && a.value && a.value.trim().length > 0;
    });
    if (filled) {
      supabase.from("games").update({
        finish_triggered_at: new Date().toISOString(),
      }).eq("id", game.id);
    }
  }, [isHost, players, answers, allFinished, game.finish_triggered_at, game.id, game.current_round, game.categories, roundIsFresh]);

  // If all humans finished (with submitted answers), end early — but not in fresh round
  useEffect(() => {
    if (isHost && allFinished && game.status === "playing" && !roundIsFresh) triggerEnd();
  }, [isHost, allFinished, game.status, triggerEnd, roundIsFresh]);

  const submit = async () => {
    const rows = game.categories.map(cat => ({
      game_id: game.id, round: game.current_round, player_id: me.playerId, category: cat, value: draft[cat] ?? "",
    }));
    await supabase.from("answers").upsert(rows, { onConflict: "game_id,round,player_id,category" });
    await supabase.from("players").update({ finished_round: true }).eq("id", me.playerId);
    toast.success("Answers locked in! ⚡");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[auto_1fr] gap-3 sm:gap-4 items-center">
        <motion.div key={game.current_letter} initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", bounce: 0.6 }}
          className="letter-tile size-20 sm:size-24 md:size-32 flex items-center justify-center text-5xl sm:text-6xl md:text-7xl">
          {game.current_letter}
        </motion.div>
        <div className="space-y-2">
          <div className="font-display text-lg font-bold">Round {game.current_round} / {game.num_rounds}</div>
          <CountdownTimer
            startedAt={game.round_started_at}
            durationSec={game.round_seconds}
            finishTriggeredAt={game.finish_triggered_at}
            finishCountdown={game.finish_countdown}
            onZero={onTimerZero}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {game.categories.map((cat) => (
          <div key={cat} className="card-pop p-3">
            <label className="block text-xs font-bold uppercase text-muted-foreground tracking-wider mb-1">{cat}</label>
            <input value={draft[cat] ?? ""} onChange={(e) => setDraft({ ...draft, [cat]: e.target.value })}
              disabled={me_player?.finished_round}
              placeholder={`${cat} starting with ${game.current_letter}…`}
              maxLength={40}
              className="w-full text-lg font-bold bg-transparent focus:outline-none disabled:opacity-60" />
          </div>
        ))}
      </div>

      <button onClick={submit} disabled={me_player?.finished_round}
        className="w-full btn-pop bg-primary text-primary-foreground py-3 text-lg disabled:opacity-50">
        {me_player?.finished_round ? "Waiting for others… ⏳" : "I'm done! 🚀"}
      </button>
    </div>
  );
}

function botAnswer(cat: string, letter: string): string {
  const dict: Record<string, string[]> = {
    Name: ["Alice","Bob","Charlie","Diana","Ethan","Fiona","George","Hannah","Ivan","Julia","Kevin","Lara","Mike","Nora","Oscar","Paul","Quinn","Rita","Sam","Tom","Uma","Vera","Will","Xander","Yara","Zoe"],
    Place: ["Argentina","Brazil","Chile","Denmark","Egypt","France","Germany","Hungary","India","Japan","Kenya","Laos","Mexico","Norway","Oman","Peru","Qatar","Russia","Spain","Turkey","Uganda","Vietnam","Wales"],
    Animal: ["Ant","Bear","Cat","Dog","Elephant","Fox","Giraffe","Horse","Iguana","Jaguar","Koala","Lion","Monkey","Newt","Octopus","Panda","Quail","Rabbit","Snake","Tiger","Urial","Vulture","Whale"],
    Thing: ["Apple","Box","Chair","Desk","Egg","Fork","Glass","Hat","Ink","Jar","Kite","Lamp","Map","Net","Oven","Pen","Quilt","Ring","Spoon","Table","Umbrella","Vase","Watch"],
    Food: ["Apple","Banana","Cheese","Donut","Eggs","Fries","Garlic","Honey","Icecream","Jam","Kebab","Lasagna","Mango","Nachos","Olive","Pasta","Quiche","Rice","Sushi","Taco","Udon","Veggie","Waffle"],
    Movie: ["Avatar","Batman","Cars","Dune","Elf","Frozen","Grease","Heat","Inception","Jaws","KingKong","Lion King","Matrix","Nemo","Oppenheimer","Predator","Quiz Show","Rocky","Shrek","Titanic","Up","Vertigo","Wall-E"],
  };
  const pool = (dict[cat] ?? dict.Thing).filter(w => w.toUpperCase().startsWith(letter.toUpperCase()));
  if (pool.length === 0) return Math.random() > 0.5 ? "" : letter + "thing";
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- Round results ----------
function RoundResults({ game, players, answers, isHost }:
  { game: Game; players: Player[]; answers: Answer[]; isHost: boolean }) {
  const round = game.current_round;
  const roundAnswers = answers.filter(a => a.round === round);

  const next = async () => { await nextStep(game); };

  return (
    <div className="card-pop p-5 space-y-4">
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold">Round {round} results · Letter {game.current_letter}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-2">Player</th>
              {game.categories.map(c => <th key={c} className="p-2">{c}</th>)}
              <th className="p-2 text-right">+pts</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
              const got = game.categories.reduce((sum, c) => {
                const a = roundAnswers.find(x => x.player_id === p.id && x.category === c);
                return sum + (a?.points ?? 0);
              }, 0);
              return (
                <tr key={p.id} className="border-t-2 border-foreground/10">
                  <td className="p-2 font-bold whitespace-nowrap">{p.emoji} {p.nickname}</td>
                  {game.categories.map(c => {
                    const a = roundAnswers.find(x => x.player_id === p.id && x.category === c);
                    if (!a || !a.value) return <td key={c} className="p-2 text-muted-foreground italic">—</td>;
                    const cls =
                      a.status === "valid" ? "bg-success/20 text-success-foreground" :
                      a.status === "duplicate" ? "bg-warning/20" :
                      "bg-destructive/15 line-through opacity-70";
                    return <td key={c} className="p-2"><span className={`rounded-md px-1.5 py-0.5 ${cls}`}>{a.value}</span></td>;
                  })}
                  <td className="p-2 text-right font-display font-bold tabular-nums">+{got}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {isHost && (
        <button onClick={next} className="w-full btn-pop bg-primary text-primary-foreground py-3 text-lg">
          {game.current_round >= game.num_rounds ? "🏁 See final leaderboard" : "Next round →"}
        </button>
      )}
    </div>
  );
}

// ---------- Final leaderboard ----------
function FinalLeaderboard({ players, gameId, game, isHost }: { players: Player[]; gameId: string; game: Game; isHost: boolean }) {
  const sorted = [...players].sort((a,b) => b.score - a.score);
  const titles = [
    { emoji: "🏆", title: "Word Master ✍️" },
    { emoji: "🥈", title: "Quick Thinker ⚡" },
    { emoji: "🥉", title: "Wordsmith 📚" },
  ];
  const fun = ["Animal Lover 🐾", "Explorer 🌍", "Foodie 🍕", "Cinephile 🎬", "Rookie 🌱"];
  const cardRef = useRef<HTMLDivElement>(null);

  const downloadImage = async () => {
    if (!cardRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `nameplacego-${gameId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e: any) { toast.error("Couldn't generate image"); }
  };

  const shareNative = async () => {
    if (!cardRef.current) return;
    const winner = sorted[0];
    const text = `🏆 ${winner?.nickname} just won NamePlaceGo! with ${winner?.score} pts. Play at ${window.location.origin}`;
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const file = blob ? new File([blob], "nameplacego-win.png", { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: "NamePlaceGo!" });
        return;
      }
      if (navigator.share) { await navigator.share({ text, url: window.location.origin }); return; }
      await navigator.clipboard.writeText(text);
      toast.success("Result copied — paste it anywhere!");
    } catch { /* user dismissed */ }
  };

  const shareTwitter = () => {
    const winner = sorted[0];
    const text = `🏆 ${winner?.nickname} won NamePlaceGo! with ${winner?.score} pts. Try to beat them →`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.origin)}`;
    window.open(url, "_blank");
  };

  const shareWhatsapp = () => {
    const winner = sorted[0];
    const text = `🏆 ${winner?.nickname} won NamePlaceGo! with ${winner?.score} pts. Play at ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div ref={cardRef} className="card-pop p-4 sm:p-6 space-y-5">
        <div className="text-center">
          <Trophy className="mx-auto size-12 text-warning" />
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2">Game over!</h2>
        </div>
        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-center gap-3">
          {[1, 0, 2].map((rank) => {
            const p = sorted[rank];
            if (!p) return null;
            const sizeCls =
              rank === 0 ? "w-full sm:w-56 sm:scale-110 z-10" :
              rank === 1 ? "w-full sm:w-48 sm:opacity-95" :
              "w-full sm:w-40 sm:opacity-90 sm:scale-95";
            const orderCls = rank === 1 ? "sm:order-1" : rank === 0 ? "sm:order-2" : "sm:order-3";
            const bg = rank === 0 ? "var(--fun-3)" : rank === 1 ? "var(--fun-2)" : "var(--fun-1)";
            return (
              <motion.div key={p.id}
                initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: rank * 0.15, type: "spring" }}
                className={`card-pop p-4 text-center ${sizeCls} ${orderCls}`}
                style={{ background: bg }}>
                <div className={rank === 0 ? "text-6xl" : "text-4xl"}>{titles[rank].emoji}</div>
                <div className="font-display text-lg sm:text-xl font-bold mt-2 break-words">{p.emoji} {p.nickname}</div>
                <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums">{p.score}</div>
                <div className="text-xs sm:text-sm font-bold mt-1">{titles[rank].title}</div>
              </motion.div>
            );
          })}
        </div>
        {sorted.length > 3 && (
          <ul className="space-y-1">
            {sorted.slice(3).map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/60">
                <span className="font-display font-bold text-muted-foreground">#{i + 4}</span>
                <span className="font-bold flex-1 truncate">{p.emoji} {p.nickname}</span>
                <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">{fun[i % fun.length]}</span>
                <span className="font-display font-bold tabular-nums">{p.score}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-center text-xs text-muted-foreground font-bold">nameplacego.app · #NamePlaceGo</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button onClick={shareNative} className="btn-pop bg-primary text-primary-foreground py-2.5 text-sm flex items-center justify-center gap-1.5">
          <Share2 className="size-4" /> Share
        </button>
        <button onClick={downloadImage} className="btn-pop bg-card text-foreground py-2.5 text-sm">📷 Save image</button>
        <button onClick={shareTwitter} className="btn-pop bg-secondary text-secondary-foreground py-2.5 text-sm">𝕏 Twitter</button>
        <button onClick={shareWhatsapp} className="btn-pop py-2.5 text-sm" style={{ background: "var(--fun-4)" }}>💬 WhatsApp</button>
      </div>

      {isHost && (
        <button onClick={async () => {
          await supabase.from("answers").delete().eq("game_id", game.id);
          await supabase.from("players").update({ score: 0, finished_round: false }).eq("game_id", game.id);
          await supabase.from("games").update({
            status: "lobby", current_round: 0, current_letter: null,
            round_started_at: null, finish_triggered_at: null, used_letters: [],
          }).eq("id", game.id);
          toast.success("Rematch! Back to lobby — settings preserved.");
        }}
          className="w-full btn-pop bg-accent text-accent-foreground py-3 text-lg">
          🔁 Rematch (back to lobby)
        </button>
      )}
    </div>
  );
}
