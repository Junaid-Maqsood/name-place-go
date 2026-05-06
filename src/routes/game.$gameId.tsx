import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import {
  type Game, type Player, type Answer, loadSession, saveSession,
  startRound, endRound, nextStep, DEFAULT_CATEGORIES, clearSession, pickRandomEmoji,
} from "@/lib/game";
import { ChatPanel } from "@/components/game/ChatPanel";
import { PlayerList } from "@/components/game/PlayerList";
import { CountdownTimer } from "@/components/game/CountdownTimer";
import { Copy, Play, Plus, X, LogOut, Trophy, Bot, Settings } from "lucide-react";

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

  // Confetti when finished
  useEffect(() => {
    if (game?.status === "finished") {
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
    }
  }, [game?.status]);

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

  return (
    <main className="min-h-screen p-3 md:p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">NamePlaceGo!</h1>
          <GameCodeChip gameId={gameId} />
        </div>
        <button onClick={leave} className="btn-pop bg-card text-foreground px-3 py-2 text-sm flex items-center gap-1">
          <LogOut className="size-4" /> Leave
        </button>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <section className="space-y-4">
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
          {game.status === "finished" && <FinalLeaderboard players={players} />}
        </section>

        <aside className="space-y-4">
          <PlayerList players={players} hostId={game.host_player_id} currentPlayerId={me.playerId}
            showFinished={game.status === "playing"} />
          <ChatPanel gameId={gameId} nickname={me.nickname} playerId={me.playerId} />
        </aside>
      </div>
    </main>
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
  const [rounds, setRounds] = useState(game.num_rounds);
  const [seconds, setSeconds] = useState(game.round_seconds);
  const [finish, setFinish] = useState(game.finish_countdown);
  const [cats, setCats] = useState<string[]>(game.categories);
  const [newCat, setNewCat] = useState("");

  const save = async () => {
    await supabase.from("games").update({
      num_rounds: rounds, round_seconds: seconds, finish_countdown: finish, categories: cats,
    }).eq("id", game.id);
    toast.success("Settings saved");
  };

  const addBot = async () => {
    const names = ["BotBuddy", "RoboRex", "MegaMind", "PixelPete", "ChipChamp"];
    const used = players.map(p => p.nickname);
    const name = names.find(n => !used.includes(n)) ?? `Bot${Math.floor(Math.random()*99)}`;
    await supabase.from("players").insert({
      game_id: game.id, nickname: name, emoji: pickRandomEmoji(players.map(p => p.emoji)), is_bot: true,
    });
  };

  const start = async () => {
    if (players.length < 1) return toast.error("Need at least 1 player");
    await save();
    await startRound({ ...game, num_rounds: rounds, round_seconds: seconds, finish_countdown: finish, categories: cats });
  };

  return (
    <div className="card-pop p-6 space-y-5">
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold">Lobby</h2>
        <p className="text-muted-foreground">Waiting to start · {players.length}/10 players</p>
      </div>

      {isHost ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Rounds" value={rounds} setValue={setRounds} min={1} max={20} />
            <NumberField label="Seconds / round" value={seconds} setValue={setSeconds} min={20} max={300} />
            <NumberField label="Final countdown" value={finish} setValue={setFinish} min={5} max={60} />
          </div>

          <div>
            <label className="block font-bold mb-2 flex items-center gap-2"><Settings className="size-4" /> Categories</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {cats.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground border-2 border-foreground/20 px-3 py-1 text-sm font-bold">
                  {c}
                  <button onClick={() => setCats(cats.filter(x => x !== c))}><X className="size-3.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Add category…" maxLength={20}
                className="flex-1 rounded-full border-2 border-foreground/20 px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary" />
              <button onClick={() => { if (newCat.trim()) { setCats([...cats, newCat.trim()]); setNewCat(""); } }}
                className="btn-pop bg-accent text-accent-foreground px-3 py-2 text-sm flex items-center gap-1">
                <Plus className="size-4" /> Add
              </button>
            </div>
            {cats.length === 0 && <p className="text-xs text-destructive mt-1">Add at least one category</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={save} className="btn-pop bg-card text-foreground px-4 py-2 text-sm">Save</button>
            <button onClick={addBot} disabled={players.length >= 10}
              className="btn-pop bg-fun-4 text-foreground px-4 py-2 text-sm flex items-center gap-1"
              style={{ background: "var(--fun-4)" }}>
              <Bot className="size-4" /> Add bot
            </button>
            <button onClick={start} disabled={cats.length === 0}
              className="btn-pop bg-primary text-primary-foreground px-5 py-2 ml-auto flex items-center gap-2">
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
  { label: string; value: number; setValue: (n: number) => void; min: number; max: number }) {
  return (
    <div>
      <label className="block text-xs font-bold text-muted-foreground mb-1">{label}</label>
      <input type="number" value={value} min={min} max={max}
        onChange={(e) => setValue(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="w-full rounded-2xl border-2 border-foreground/20 px-3 py-2 font-bold text-center bg-background focus:outline-none focus:border-primary" />
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
  const me_player = players.find(p => p.id === me.playerId);
  const isHost = game.host_player_id === me.playerId;
  const allFinished = players.filter(p => !p.is_bot).every(p => p.finished_round);

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

  // Trigger end-of-round when timer hits 0 OR all human players finished triggers final countdown that expires
  const triggerEnd = useCallback(async () => {
    if (!isHost) return;
    if (game.status !== "playing") return;
    await endRound(game);
  }, [isHost, game]);

  // Trigger final countdown when first non-bot finishes
  useEffect(() => {
    if (!isHost || game.finish_triggered_at) return;
    const someoneFinished = players.some(p => p.finished_round && !p.is_bot);
    if (someoneFinished && !allFinished) {
      supabase.from("games").update({ finish_triggered_at: new Date().toISOString() }).eq("id", game.id);
    }
  }, [isHost, players, allFinished, game.finish_triggered_at, game.id]);

  // If all humans finished (incl. via final countdown), end early
  useEffect(() => {
    if (isHost && allFinished && game.status === "playing") triggerEnd();
  }, [isHost, allFinished, game.status, triggerEnd]);

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
      <div className="grid grid-cols-[auto_1fr] gap-4 items-center">
        <motion.div key={game.current_letter} initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", bounce: 0.6 }}
          className="letter-tile size-24 md:size-32 flex items-center justify-center text-6xl md:text-7xl">
          {game.current_letter}
        </motion.div>
        <div className="space-y-2">
          <div className="font-display text-lg font-bold">Round {game.current_round} / {game.num_rounds}</div>
          <CountdownTimer
            startedAt={game.round_started_at}
            durationSec={game.round_seconds}
            finishTriggeredAt={game.finish_triggered_at}
            finishCountdown={game.finish_countdown}
            onZero={triggerEnd}
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
function FinalLeaderboard({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a,b) => b.score - a.score);
  const titles = [
    { emoji: "🏆", title: "Word Master ✍️" },
    { emoji: "🥈", title: "Quick Thinker ⚡" },
    { emoji: "🥉", title: "Wordsmith 📚" },
  ];
  const fun = ["Animal Lover 🐾", "Explorer 🌍", "Foodie 🍕", "Cinephile 🎬", "Rookie 🌱"];

  return (
    <div className="card-pop p-6 space-y-5">
      <div className="text-center">
        <Trophy className="mx-auto size-12 text-warning" />
        <h2 className="font-display text-4xl font-bold mt-2">Game over!</h2>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {sorted.slice(0, 3).map((p, i) => (
          <motion.div key={p.id}
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.15, type: "spring" }}
            className={`card-pop p-4 text-center ${i === 0 ? "md:scale-110" : ""}`}
            style={{ background: i === 0 ? "var(--fun-3)" : i === 1 ? "var(--fun-2)" : "var(--fun-1)" }}>
            <div className="text-5xl">{titles[i].emoji}</div>
            <div className="font-display text-2xl font-bold mt-2">{p.emoji} {p.nickname}</div>
            <div className="font-display text-3xl font-bold tabular-nums">{p.score}</div>
            <div className="text-sm font-bold mt-1">{titles[i].title}</div>
          </motion.div>
        ))}
      </div>
      {sorted.length > 3 && (
        <ul className="space-y-1">
          {sorted.slice(3).map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/60">
              <span className="font-display font-bold text-muted-foreground">#{i + 4}</span>
              <span className="font-bold flex-1">{p.emoji} {p.nickname}</span>
              <span className="text-sm text-muted-foreground">{fun[i % fun.length]}</span>
              <span className="font-display font-bold tabular-nums">{p.score}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
