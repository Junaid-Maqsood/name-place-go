import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminRequestOtp,
  adminVerifyOtp,
  adminLogout,
  adminCheckSession,
  adminListGames,
  adminEndGame,
} from "@/lib/admin.functions";
import { Shield, LogOut, RefreshCw, X } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const checkSession = useServerFn(adminCheckSession);
  const [step, setStep] = useState<"loading" | "creds" | "otp" | "panel">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    checkSession()
      .then((r) => setStep(r.authed ? "panel" : "creds"))
      .catch(() => setStep("creds"));
  }, [checkSession]);

  const reqOtp = useServerFn(adminRequestOtp);
  const verify = useServerFn(adminVerifyOtp);
  const logout = useServerFn(adminLogout);

  const submitCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await reqOtp({ data: { email, password } });
      toast.success(r.hint ?? "Check your email for the code");
      setStep("otp");
    } catch (err: any) {
      toast.error(err.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await verify({ data: { code } });
      setStep("panel");
    } catch (err: any) {
      toast.error(err.message ?? "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  if (step === "loading") {
    return <main className="min-h-screen flex items-center justify-center">Loading…</main>;
  }

  if (step === "panel") {
    return (
      <AdminDashboard
        onLogout={async () => {
          await logout();
          setStep("creds");
        }}
      />
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card-pop w-full max-w-md p-6 space-y-4">
        <div className="text-center">
          <Shield className="mx-auto size-10 text-primary" />
          <h1 className="font-display text-2xl font-bold mt-2">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            {step === "creds" ? "Sign in with email & password" : "Enter the 6-digit code"}
          </p>
        </div>
        {step === "creds" ? (
          <form onSubmit={submitCreds} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              maxLength={255}
              className="w-full rounded-2xl border-2 border-foreground/30 px-4 py-3 bg-background font-bold focus:outline-none focus:border-primary"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              maxLength={128}
              className="w-full rounded-2xl border-2 border-foreground/30 px-4 py-3 bg-background font-bold focus:outline-none focus:border-primary"
            />
            <button
              disabled={busy}
              className="w-full btn-pop bg-primary text-primary-foreground py-3"
            >
              {busy ? "Sending code…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-3">
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              className="w-full text-center font-display tracking-[0.5em] text-2xl rounded-2xl border-2 border-foreground/30 px-4 py-3 bg-background focus:outline-none focus:border-primary"
            />
            <button disabled={busy} className="w-full btn-pop bg-primary text-primary-foreground py-3">
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => setStep("creds")}
              className="w-full text-xs text-muted-foreground"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const list = useServerFn(adminListGames);
  const end = useServerFn(adminEndGame);
  const [games, setGames] = useState<any[]>([]);
  const [filter, setFilter] = useState<"live" | "completed" | "all">("live");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await list();
      setGames(r.games);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = async (g: any) => {
    if (!confirm(`Force-end game ${g.id}? Players will be disconnected.`)) return;
    try {
      await end({ data: { gameId: g.id } });
      toast.success(`Game ${g.id} ended`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filtered = games.filter((g) => {
    if (filter === "live") return g.status === "playing" || g.status === "lobby" || g.status === "scoring" || g.status === "results";
    if (filter === "completed") return g.status === "finished" || g.status === "ended";
    return true;
  });

  return (
    <main className="min-h-screen p-3 sm:p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Shield className="size-6" /> Admin
        </h1>
        <div className="flex gap-2">
          <button onClick={refresh} className="btn-pop bg-card px-3 py-2 text-sm flex items-center gap-1">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={onLogout} className="btn-pop bg-card px-3 py-2 text-sm flex items-center gap-1">
            <LogOut className="size-4" /> Logout
          </button>
        </div>
      </header>

      <div className="flex gap-2 mb-4">
        {(["live", "completed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn-pop px-3 py-1.5 text-sm capitalize ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground self-center">{filtered.length} games</span>
      </div>

      <div className="card-pop overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="p-2">Game ID</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Players</th>
              <th className="p-2 text-right">Round</th>
              <th className="p-2">Created</th>
              <th className="p-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr key={g.id} className="border-t border-foreground/10">
                <td className="p-2 font-mono font-bold">{g.id}</td>
                <td className="p-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      g.status === "playing" ? "bg-success/20 text-success" :
                      g.status === "lobby" ? "bg-secondary/30" :
                      g.status === "ended" ? "bg-destructive/20 text-destructive" :
                      g.status === "finished" ? "bg-warning/20" : "bg-muted"
                    }`}
                  >
                    {g.status}
                  </span>
                </td>
                <td className="p-2 text-right tabular-nums">{g.player_count}</td>
                <td className="p-2 text-right tabular-nums">
                  {g.current_round}/{g.num_rounds}
                </td>
                <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(g.created_at).toLocaleString()}
                </td>
                <td className="p-2 text-right">
                  {g.status !== "ended" && g.status !== "finished" && (
                    <button
                      onClick={() => handleEnd(g)}
                      className="btn-pop bg-destructive text-destructive-foreground px-2 py-1 text-xs flex items-center gap-1 ml-auto"
                    >
                      <X className="size-3" /> End
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No games match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
