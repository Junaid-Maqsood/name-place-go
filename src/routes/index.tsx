import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createGame, joinGame, loadSession, pickRandomEmoji, PLAYER_EMOJIS, clearSession } from "@/lib/game";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Users, ArrowRight, Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: (s: Record<string, unknown>) => ({ join: typeof s.join === "string" ? s.join : undefined }),
});

function Home() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [nickname, setNickname] = useState("");
  const [emoji, setEmoji] = useState(pickRandomEmoji());
  const [code, setCode] = useState(search.join ?? "");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [resume, setResume] = useState<{ gameId: string; nickname: string } | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (s) setResume({ gameId: s.gameId, nickname: s.nickname });
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const handleCreate = async () => {
    if (!nickname.trim()) return toast.error("Pick a nickname first");
    setLoading(true);
    try {
      const { gameId } = await createGame(nickname.trim().slice(0, 16), emoji);
      navigate({ to: "/game/$gameId", params: { gameId } });
    } catch (e: any) { toast.error(e.message ?? "Couldn't create game"); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) return toast.error("Pick a nickname first");
    if (!code.trim()) return toast.error("Enter a game code");
    setLoading(true);
    try {
      const { gameId } = await joinGame(code.trim(), nickname.trim().slice(0, 16), emoji);
      navigate({ to: "/game/$gameId", params: { gameId } });
    } catch (e: any) { toast.error(e.message ?? "Couldn't join"); }
    finally { setLoading(false); }
  };

  const handleResume = async () => {
    if (!resume) return;
    const { data } = await supabase.from("games").select("id").eq("id", resume.gameId).maybeSingle();
    if (!data) { clearSession(); setResume(null); toast.error("That game no longer exists"); return; }
    navigate({ to: "/game/$gameId", params: { gameId: resume.gameId } });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <button onClick={() => setDark(d => !d)}
        className="absolute top-4 right-4 btn-pop bg-card text-foreground size-12 flex items-center justify-center"
        aria-label="Toggle theme">
        {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>

      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }} className="text-center mb-8">
        <h1 className="font-display text-6xl md:text-8xl font-bold leading-none">
          <span className="inline-block text-[oklch(var(--fun-1))]">Name</span>
          <span className="inline-block text-[oklch(var(--fun-2))]">Place</span>
          <span className="inline-block text-[oklch(var(--fun-4))]">Go</span>
          <span className="inline-block text-[oklch(var(--fun-1))]">!</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground font-bold">Pick a letter. Fill the boxes. Beat your friends.</p>
      </motion.div>

      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
        className="card-pop w-full max-w-lg p-6 space-y-5">
        {resume && (
          <button onClick={handleResume}
            className="w-full btn-pop bg-success text-success-foreground py-2 px-4 text-sm">
            Rejoin game {resume.gameId} as {resume.nickname} →
          </button>
        )}

        <div>
          <label className="block font-bold mb-2">Your nickname</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)}
            maxLength={16} placeholder="LegendaryLlama"
            className="w-full text-lg rounded-2xl border-3 border-foreground/30 px-4 py-3 bg-background font-bold focus:outline-none focus:border-primary" />
        </div>

        <div>
          <label className="block font-bold mb-2">Pick your avatar</label>
          <div className="flex flex-wrap gap-2">
            {PLAYER_EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)}
                className={`text-2xl size-11 rounded-full border-2 transition-all ${
                  emoji === e ? "border-primary scale-110 bg-primary/10" : "border-foreground/15 hover:scale-105"
                }`}>{e}</button>
            ))}
          </div>
        </div>

        <button onClick={handleCreate} disabled={loading}
          className="w-full btn-pop bg-primary text-primary-foreground text-lg py-3 flex items-center justify-center gap-2">
          <Sparkles className="size-5" /> Create new game
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-foreground/20" />
          <span className="text-xs font-bold text-muted-foreground">OR</span>
          <div className="flex-1 h-px bg-foreground/20" />
        </div>

        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6} placeholder="GAME ID"
            className="flex-1 text-center font-display tracking-widest text-2xl uppercase rounded-2xl border-3 border-foreground/30 px-4 py-3 bg-background focus:outline-none focus:border-secondary" />
          <button onClick={handleJoin} disabled={loading}
            className="btn-pop bg-secondary text-secondary-foreground px-5 flex items-center gap-2">
            <Users className="size-5" /> Join <ArrowRight className="size-4" />
          </button>
        </div>
      </motion.div>

      <p className="mt-8 text-xs text-muted-foreground">Up to 10 players · No account needed</p>
    </main>
  );
}
