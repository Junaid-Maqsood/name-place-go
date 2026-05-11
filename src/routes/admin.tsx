import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminLogin, adminLogout, adminCheckSession,
  adminForgotPassword, adminResetPassword,
  adminListGames, adminGameDetails, adminEndGame,
  adminKickPlayer, adminBroadcast, adminMutePlayer,
  adminListAttempts, adminListAuditLog, adminListErrors,
  adminAnalytics,
} from "@/lib/admin.functions";
import {
  Shield, LogOut, RefreshCw, X, ArrowLeft, Send, MicOff, Mic, Activity,
  Users, AlertTriangle, ScrollText, BarChart3, Lock, Gamepad2, FlaskConical,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { title: "Admin · NamePlaceGo!" },
    ],
  }),
});

type Step = "loading" | "login" | "forgot" | "reset" | "panel";

function AdminPage() {
  const checkSession = useServerFn(adminCheckSession);
  const [step, setStep] = useState<Step>("loading");
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("reset");
    if (t) {
      setResetToken(t);
      setStep("reset");
      return;
    }
    checkSession()
      .then((r) => setStep(r.authed ? "panel" : "login"))
      .catch(() => setStep("login"));
  }, [checkSession]);

  if (step === "loading") return <main className="min-h-screen flex items-center justify-center">Loading…</main>;
  if (step === "panel") return <AdminDashboard onLogout={() => setStep("login")} />;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      {step === "login" && <LoginForm onSuccess={() => setStep("panel")} onForgot={() => setStep("forgot")} />}
      {step === "forgot" && <ForgotForm onBack={() => setStep("login")} />}
      {step === "reset" && resetToken && (
        <ResetForm token={resetToken} onDone={() => { window.history.replaceState({}, "", "/admin"); setStep("login"); }} />
      )}
    </main>
  );
}

function LoginForm({ onSuccess, onForgot }: { onSuccess: () => void; onForgot: () => void }) {
  const login = useServerFn(adminLogin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="card-pop w-full max-w-md p-6 space-y-4">
      <div className="text-center">
        <Shield className="mx-auto size-10 text-primary" />
        <h1 className="font-display text-2xl font-bold mt-2">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">Sign in to continue</p>
      </div>
      <form onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try { await login({ data: { email, password } }); onSuccess(); }
        catch (err: any) { toast.error(err.message ?? "Login failed"); }
        finally { setBusy(false); }
      }} className="space-y-3">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" maxLength={255} autoComplete="username"
          className="w-full rounded-2xl border-2 border-foreground/30 px-4 py-3 bg-background font-bold focus:outline-none focus:border-primary" />
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" maxLength={128} autoComplete="current-password"
          className="w-full rounded-2xl border-2 border-foreground/30 px-4 py-3 bg-background font-bold focus:outline-none focus:border-primary" />
        <button disabled={busy} className="w-full btn-pop bg-primary text-primary-foreground py-3">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button type="button" onClick={onForgot} className="w-full text-xs text-muted-foreground underline">
          Forgot password?
        </button>
      </form>
    </div>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const forgot = useServerFn(adminForgotPassword);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="card-pop w-full max-w-md p-6 space-y-4">
      <div className="text-center">
        <Lock className="mx-auto size-8 text-primary" />
        <h1 className="font-display text-2xl font-bold mt-2">Reset Password</h1>
        <p className="text-sm text-muted-foreground">We'll send a secure reset link to your email.</p>
      </div>
      <form onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try {
          await forgot({ data: { email } });
          toast.success("If that email is registered, a reset link has been sent.");
          onBack();
        } catch (err: any) { toast.error(err.message); }
        finally { setBusy(false); }
      }} className="space-y-3">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Admin email" maxLength={255}
          className="w-full rounded-2xl border-2 border-foreground/30 px-4 py-3 bg-background font-bold focus:outline-none focus:border-primary" />
        <button disabled={busy} className="w-full btn-pop bg-primary text-primary-foreground py-3">
          {busy ? "Sending…" : "Send reset link"}
        </button>
        <button type="button" onClick={onBack} className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1">
          <ArrowLeft className="size-3" /> Back
        </button>
      </form>
    </div>
  );
}

function ResetForm({ token, onDone }: { token: string; onDone: () => void }) {
  const reset = useServerFn(adminResetPassword);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="card-pop w-full max-w-md p-6 space-y-4">
      <div className="text-center">
        <Lock className="mx-auto size-8 text-primary" />
        <h1 className="font-display text-2xl font-bold mt-2">Set new password</h1>
      </div>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
        if (password !== confirm) { toast.error("Passwords don't match"); return; }
        setBusy(true);
        try {
          await reset({ data: { token, newPassword: password } });
          toast.success("Password updated. Please sign in.");
          onDone();
        } catch (err: any) { toast.error(err.message); }
        finally { setBusy(false); }
      }} className="space-y-3">
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (min 8 chars)" maxLength={128}
          className="w-full rounded-2xl border-2 border-foreground/30 px-4 py-3 bg-background font-bold focus:outline-none focus:border-primary" />
        <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password" maxLength={128}
          className="w-full rounded-2xl border-2 border-foreground/30 px-4 py-3 bg-background font-bold focus:outline-none focus:border-primary" />
        <button disabled={busy} className="w-full btn-pop bg-primary text-primary-foreground py-3">
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

// ===== Dashboard =====

type TabKey = "overview" | "live" | "history" | "audit" | "errors" | "security" | "sandbox";

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const logout = useServerFn(adminLogout);
  const [tab, setTab] = useState<TabKey>("overview");
  const [focusGameId, setFocusGameId] = useState<string | null>(null);

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "live", label: "Live games", icon: Gamepad2 },
    { key: "history", label: "History", icon: ScrollText },
    { key: "audit", label: "Audit log", icon: Activity },
    { key: "errors", label: "Error logs", icon: AlertTriangle },
    { key: "security", label: "Security", icon: Shield },
    { key: "sandbox", label: "Sandbox", icon: FlaskConical },
  ];

  return (
    <main className="min-h-screen p-3 sm:p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Shield className="size-6" /> Admin
        </h1>
        <button onClick={async () => { await logout(); onLogout(); }} className="btn-pop bg-card px-3 py-2 text-sm flex items-center gap-1">
          <LogOut className="size-4" /> Logout
        </button>
      </header>

      <nav className="flex gap-1.5 mb-4 overflow-x-auto pb-2 -mx-1 px-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setFocusGameId(null); }}
              className={`btn-pop px-3 py-2 text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap ${
                active ? "bg-primary text-primary-foreground" : "bg-card"
              }`}>
              <Icon className="size-3.5" /> {t.label}
            </button>
          );
        })}
      </nav>

      {focusGameId ? (
        <GameDetailsPanel gameId={focusGameId} onBack={() => setFocusGameId(null)} />
      ) : (
        <>
          {tab === "overview" && <OverviewTab onOpen={(id) => { setFocusGameId(id); }} />}
          {tab === "live" && <GamesTab filter="live" onOpen={setFocusGameId} />}
          {tab === "history" && <GamesTab filter="completed" onOpen={setFocusGameId} />}
          {tab === "audit" && <AuditTab />}
          {tab === "errors" && <ErrorsTab />}
          {tab === "security" && <SecurityTab />}
          {tab === "sandbox" && <SandboxTab />}
        </>
      )}
    </main>
  );
}

function OverviewTab({ onOpen }: { onOpen: (id: string) => void }) {
  const analytics = useServerFn(adminAnalytics);
  const list = useServerFn(adminListGames);
  const [stats, setStats] = useState<{ gamesTotal: number; gamesLive: number; playersTotal: number; errors24: number } | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  useEffect(() => {
    const refresh = async () => {
      try {
        const [a, g] = await Promise.all([analytics(), list()]);
        setStats(a); setRecent(g.games.slice(0, 5));
      } catch (e: any) { toast.error(e.message); }
    };
    refresh(); const id = setInterval(refresh, 7000); return () => clearInterval(id);
  }, [analytics, list]);
  if (!stats) return <p className="p-6 text-center text-muted-foreground">Loading…</p>;
  const Card = ({ label, value, tone }: { label: string; value: number | string; tone?: string }) => (
    <div className="card-pop p-4">
      <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className={`font-display text-3xl font-bold mt-1 tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Total games" value={stats.gamesTotal} />
        <Card label="Live games" value={stats.gamesLive} tone="text-success" />
        <Card label="Players (all-time)" value={stats.playersTotal} />
        <Card label="Errors (24h)" value={stats.errors24} tone={stats.errors24 > 0 ? "text-destructive" : ""} />
      </div>
      <div className="card-pop p-4">
        <h3 className="font-display font-bold mb-3 flex items-center gap-2"><Gamepad2 className="size-4" /> Recent games</h3>
        <ul className="divide-y divide-foreground/10">
          {recent.map((g) => (
            <li key={g.id} className="py-2 flex items-center gap-2 text-sm">
              <button className="font-mono font-bold underline" onClick={() => onOpen(g.id)}>{g.id}</button>
              <span className="text-xs text-muted-foreground">{g.status}</span>
              <span className="ml-auto tabular-nums">{g.player_count} players</span>
            </li>
          ))}
          {recent.length === 0 && <li className="py-4 text-center text-muted-foreground">No games yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function GamesTab({ filter, onOpen }: { filter: "live" | "completed"; onOpen: (id: string) => void }) {
  const list = useServerFn(adminListGames);
  const end = useServerFn(adminEndGame);
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    try { const r = await list(); setGames(r.games); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); /* eslint-disable-line */ }, []);
  const filtered = games.filter((g) =>
    filter === "live"
      ? ["lobby", "playing", "scoring", "results"].includes(g.status)
      : ["finished", "ended"].includes(g.status)
  );
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{filtered.length} games</span>
        <button onClick={refresh} className="btn-pop bg-card px-3 py-1.5 text-xs flex items-center gap-1">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      <div className="card-pop overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-foreground/5">
            <tr className="text-left">
              <th className="p-2">Game ID</th><th className="p-2">Status</th>
              <th className="p-2 text-right">Players</th><th className="p-2 text-right">Round</th>
              <th className="p-2">Created</th><th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr key={g.id} className="border-t border-foreground/10">
                <td className="p-2"><button onClick={() => onOpen(g.id)} className="font-mono font-bold underline">{g.id}</button></td>
                <td className="p-2"><StatusPill status={g.status} /></td>
                <td className="p-2 text-right tabular-nums">{g.player_count}</td>
                <td className="p-2 text-right tabular-nums">{g.current_round}/{g.num_rounds}</td>
                <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(g.created_at).toLocaleString()}</td>
                <td className="p-2 text-right">
                  {!["ended","finished"].includes(g.status) && (
                    <button onClick={async () => {
                      if (!confirm(`End game ${g.id}?`)) return;
                      try { await end({ data: { gameId: g.id } }); toast.success("Game ended"); refresh(); }
                      catch (e: any) { toast.error(e.message); }
                    }} className="btn-pop bg-destructive text-destructive-foreground px-2 py-1 text-xs flex items-center gap-1 ml-auto">
                      <X className="size-3" /> End
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No games.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "playing" ? "bg-success/20 text-success" :
    status === "lobby" ? "bg-secondary/30" :
    status === "ended" ? "bg-destructive/20 text-destructive" :
    status === "finished" ? "bg-warning/20" : "bg-muted";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{status}</span>;
}

function GameDetailsPanel({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const fetchDetails = useServerFn(adminGameDetails);
  const kick = useServerFn(adminKickPlayer);
  const broadcast = useServerFn(adminBroadcast);
  const mute = useServerFn(adminMutePlayer);
  const end = useServerFn(adminEndGame);
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const refresh = async () => {
    try { const r = await fetchDetails({ data: { gameId } }); setData(r); }
    catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { refresh(); const id = setInterval(refresh, 4000); return () => clearInterval(id); /* eslint-disable-line */ }, [gameId]);
  if (!data) return <p className="p-6 text-center">Loading…</p>;
  const g = data.game;
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="btn-pop bg-card px-3 py-1.5 text-xs flex items-center gap-1">
        <ArrowLeft className="size-3.5" /> Back
      </button>
      <div className="card-pop p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-xl font-bold">Game {g?.id}</h2>
          <div className="flex gap-2">
            <StatusPill status={g?.status ?? "?"} />
            {g && !["ended","finished"].includes(g.status) && (
              <button onClick={async () => { if (!confirm("End game?")) return; await end({ data: { gameId } }); toast.success("Ended"); refresh(); }}
                className="btn-pop bg-destructive text-destructive-foreground px-3 py-1 text-xs">End</button>
            )}
          </div>
        </div>
        {g && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <div><div className="text-muted-foreground">Round</div><div className="font-bold">{g.current_round}/{g.num_rounds}</div></div>
            <div><div className="text-muted-foreground">Letter</div><div className="font-bold">{g.current_letter ?? "—"}</div></div>
            <div><div className="text-muted-foreground">Sec/round</div><div className="font-bold">{g.round_seconds}</div></div>
            <div><div className="text-muted-foreground">Final CD</div><div className="font-bold">{g.finish_countdown}</div></div>
          </div>
        )}
      </div>

      <div className="card-pop p-4">
        <h3 className="font-display font-bold mb-2 flex items-center gap-2"><Users className="size-4" /> Players ({data.players.length})</h3>
        <ul className="divide-y divide-foreground/10">
          {data.players.map((p: any) => (
            <li key={p.id} className="py-2 flex items-center gap-2 text-sm">
              <span>{p.emoji}</span>
              <span className="font-bold">{p.nickname}</span>
              {p.is_bot && <span className="text-xs px-1.5 py-0.5 rounded bg-muted">bot</span>}
              <span className="ml-auto tabular-nums text-xs">{p.score} pts</span>
              <button onClick={async () => {
                await mute({ data: { playerId: p.id, muted: !p.host_muted } });
                toast.success(p.host_muted ? "Unmuted" : "Muted"); refresh();
              }} className="btn-pop bg-card px-2 py-1 text-xs">
                {p.host_muted ? <Mic className="size-3" /> : <MicOff className="size-3" />}
              </button>
              <button onClick={async () => {
                if (!confirm(`Kick ${p.nickname}?`)) return;
                await kick({ data: { gameId, playerId: p.id } }); toast.success("Kicked"); refresh();
              }} className="btn-pop bg-destructive text-destructive-foreground px-2 py-1 text-xs">Kick</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card-pop p-4">
        <h3 className="font-display font-bold mb-2 flex items-center gap-2"><Send className="size-4" /> Broadcast announcement</h3>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!msg.trim()) return;
          await broadcast({ data: { gameId, message: msg.trim() } });
          toast.success("Sent"); setMsg("");
        }} className="flex gap-2">
          <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={280}
            placeholder="Message to all players…"
            className="flex-1 rounded-xl border-2 border-foreground/20 px-3 py-2 bg-background text-sm focus:outline-none focus:border-primary" />
          <button className="btn-pop bg-primary text-primary-foreground px-3 py-2 text-sm">Send</button>
        </form>
      </div>
    </div>
  );
}

function AuditTab() {
  const fetchAudit = useServerFn(adminListAuditLog);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { fetchAudit().then((r) => setRows(r.audit)).catch(() => {}); }, [fetchAudit]);
  return (
    <div className="card-pop overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-foreground/5"><tr className="text-left">
          <th className="p-2">When</th><th className="p-2">Game</th><th className="p-2">Event</th><th className="p-2">Details</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-foreground/10">
              <td className="p-2 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
              <td className="p-2 font-mono">{r.game_id}</td>
              <td className="p-2"><span className="rounded px-1.5 py-0.5 bg-muted text-xs font-bold">{r.event}</span></td>
              <td className="p-2 text-xs text-muted-foreground"><code>{JSON.stringify(r.details)}</code></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No audit entries.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ErrorsTab() {
  const fetchErrors = useServerFn(adminListErrors);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const refresh = async () => {
    try { const r = await fetchErrors({ data: { q: q || undefined, category: category || undefined } }); setRows(r.errors); }
    catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [category]);
  const cats = ["", "frontend", "backend", "voice", "auth", "multiplayer"];
  const exportCsv = () => {
    const header = "created_at,category,severity,message,game_id,url\n";
    const body = rows.map((r) => [r.created_at, r.category, r.severity, JSON.stringify(r.message), r.game_id ?? "", r.url ?? ""].join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "error-logs.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
          className="rounded-xl border-2 border-foreground/20 px-3 py-1.5 bg-background text-sm" />
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border-2 border-foreground/20 px-3 py-1.5 bg-background text-sm">
          {cats.map((c) => <option key={c} value={c}>{c || "All categories"}</option>)}
        </select>
        <button onClick={refresh} className="btn-pop bg-card px-3 py-1.5 text-sm">Search</button>
        <button onClick={exportCsv} className="btn-pop bg-card px-3 py-1.5 text-sm ml-auto">Export CSV</button>
      </div>
      <div className="card-pop overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-foreground/5"><tr className="text-left">
            <th className="p-2">When</th><th className="p-2">Cat</th><th className="p-2">Sev</th>
            <th className="p-2">Message</th><th className="p-2">Game</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10 align-top">
                <td className="p-2 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2"><span className="rounded px-1.5 py-0.5 bg-muted text-xs">{r.category}</span></td>
                <td className="p-2 text-xs">{r.severity}</td>
                <td className="p-2 text-xs">
                  <div className="font-bold break-words">{r.message}</div>
                  {r.stack && <details className="mt-1"><summary className="text-muted-foreground cursor-pointer">stack</summary><pre className="text-[10px] whitespace-pre-wrap">{r.stack}</pre></details>}
                </td>
                <td className="p-2 font-mono text-xs">{r.game_id ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No errors.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SecurityTab() {
  const fetchAttempts = useServerFn(adminListAttempts);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { fetchAttempts().then((r) => setRows(r.attempts)).catch(() => {}); }, [fetchAttempts]);
  const failed = useMemo(() => rows.filter((r) => !r.success), [rows]);
  const byIp: Record<string, number> = {};
  for (const r of failed) byIp[r.ip ?? "unknown"] = (byIp[r.ip ?? "unknown"] ?? 0) + 1;
  const suspiciousIps = Object.entries(byIp).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-pop p-3"><div className="text-xs uppercase text-muted-foreground">Total attempts</div><div className="font-display text-2xl font-bold">{rows.length}</div></div>
        <div className="card-pop p-3"><div className="text-xs uppercase text-muted-foreground">Failed</div><div className="font-display text-2xl font-bold text-destructive">{failed.length}</div></div>
        <div className="card-pop p-3"><div className="text-xs uppercase text-muted-foreground">Suspicious IPs</div><div className="font-display text-2xl font-bold">{suspiciousIps.length}</div></div>
        <div className="card-pop p-3"><div className="text-xs uppercase text-muted-foreground">Rate limit</div><div className="font-display text-sm font-bold">5 / 15m / email</div></div>
      </div>
      <div className="card-pop p-4">
        <h3 className="font-display font-bold mb-2">Suspicious IPs (3+ failures)</h3>
        {suspiciousIps.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="text-sm space-y-1">{suspiciousIps.map(([ip, n]) => (
            <li key={ip} className="flex justify-between"><span className="font-mono">{ip}</span><span className="text-destructive font-bold">{n} fails</span></li>
          ))}</ul>
        )}
      </div>
      <div className="card-pop overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-foreground/5"><tr className="text-left">
            <th className="p-2">When</th><th className="p-2">Email</th><th className="p-2">IP</th><th className="p-2">Status</th><th className="p-2">Reason</th>
          </tr></thead>
          <tbody>
            {rows.slice(0, 100).map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="p-2 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2 text-xs">{r.email ?? "—"}</td>
                <td className="p-2 text-xs font-mono">{r.ip ?? "—"}</td>
                <td className="p-2"><span className={`text-xs px-1.5 py-0.5 rounded font-bold ${r.success ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>{r.success ? "ok" : "fail"}</span></td>
                <td className="p-2 text-xs text-muted-foreground">{r.reason ?? ""}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No login attempts logged.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card-pop p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-bold text-foreground">Hardening notes</p>
        <p>• Admin route blocks indexing via robots meta. • Password reset tokens are SHA-256 hashed and expire in 30 minutes. • Passwords are scrypt-hashed with per-user salt. • Login is rate-limited (5 fails / 15 min / email). • Session cookies are httpOnly + Secure + SameSite=Lax with 8h TTL.</p>
      </div>
    </div>
  );
}

function SandboxTab() {
  return (
    <div className="card-pop p-6 space-y-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-5 text-primary" />
        <h3 className="font-display text-xl font-bold">Sandbox / Test bed</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Spin up a real game with bots to test multiplayer sync, countdown logic, voice chat, and admin controls.
      </p>
      <ol className="text-sm list-decimal list-inside space-y-1">
        <li>Open the homepage in a separate tab and create a new game.</li>
        <li>From the lobby, add 2–9 bot players using the <em>Add bot</em> button.</li>
        <li>Tweak <em>Seconds/round</em> and <em>Final Countdown</em> to verify the timer override.</li>
        <li>Return to <em>Live games</em> here to spectate, broadcast, mute, kick, or force-end.</li>
      </ol>
      <a href="/" target="_blank" rel="noopener" className="inline-flex btn-pop bg-primary text-primary-foreground px-4 py-2 text-sm">
        Open game homepage →
      </a>
    </div>
  );
}
