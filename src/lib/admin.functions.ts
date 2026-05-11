// Admin auth + control server functions.
// Email + password login (no OTP). Forgot-password via emailed reset link
// (logged to server console — wire up email delivery later).
import { createServerFn } from "@tanstack/react-start";
import { setCookie, getCookie, deleteCookie, getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import crypto from "node:crypto";

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "junaidmksud@gmail.com";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "&9%uZ56,JJ";
const SESSION_COOKIE = "npg_admin";
const SESSION_TTL_SEC = 60 * 60 * 8;
const MAX_FAILED_PER_WINDOW = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function hashPassword(password: string, salt?: string) {
  const s = salt ?? crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, s, 64).toString("hex");
  return `scrypt$${s}$${derived}`;
}
function verifyPassword(password: string, stored: string) {
  try {
    const [scheme, salt, hash] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
  } catch { return false; }
}
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getStoredCreds(sb: ReturnType<typeof admin>) {
  const { data } = await sb.from("admin_credentials" as any).select("*").eq("id", 1).maybeSingle();
  return data as { email: string; password_hash: string } | null;
}

async function logAttempt(sb: ReturnType<typeof admin>, email: string | null, success: boolean, reason?: string) {
  let ip: string | null = null;
  try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch {}
  await sb.from("admin_login_attempts" as any).insert({ email, ip, success, reason });
}

async function isLoggedIn() {
  const v = getCookie(SESSION_COOKIE);
  return !!v && v.startsWith("1:");
}

async function rateLimited(sb: ReturnType<typeof admin>, email: string) {
  const since = new Date(Date.now() - FAIL_WINDOW_MS).toISOString();
  const { count } = await sb
    .from("admin_login_attempts" as any)
    .select("*", { count: "exact", head: true })
    .eq("email", email).eq("success", false).gte("created_at", since);
  return (count ?? 0) >= MAX_FAILED_PER_WINDOW;
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(128),
  }).parse)
  .handler(async ({ data }) => {
    const sb = admin();
    const email = data.email.trim().toLowerCase();
    if (await rateLimited(sb, email)) {
      await logAttempt(sb, email, false, "rate_limited");
      throw new Error("Too many failed attempts. Try again in 15 minutes.");
    }
    const stored = await getStoredCreds(sb);
    let ok = false;
    if (stored) {
      ok = email === stored.email.toLowerCase() && verifyPassword(data.password, stored.password_hash);
    } else {
      ok = email === DEFAULT_ADMIN_EMAIL.toLowerCase() && data.password === DEFAULT_ADMIN_PASSWORD;
    }
    await new Promise(r => setTimeout(r, 400));
    if (!ok) {
      await logAttempt(sb, email, false, "bad_credentials");
      throw new Error("Invalid email or password");
    }
    await logAttempt(sb, email, true);
    const token = `1:${crypto.randomUUID()}`;
    setCookie(SESSION_COOKIE, token, {
      httpOnly: true, secure: true, sameSite: "lax", maxAge: SESSION_TTL_SEC, path: "/",
    });
    return { ok: true };
  });

export const adminForgotPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email().max(255) }).parse)
  .handler(async ({ data }) => {
    const sb = admin();
    const email = data.email.trim().toLowerCase();
    const stored = await getStoredCreds(sb);
    const allowed = stored ? email === stored.email.toLowerCase() : email === DEFAULT_ADMIN_EMAIL.toLowerCase();
    // Always return ok to avoid email enumeration
    if (!allowed) return { ok: true };
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await sb.from("admin_password_resets" as any).insert({
      email, token_hash: hashToken(token), expires_at: expires,
    });
    let origin = "";
    try { origin = getRequestHeader("origin") ?? getRequestHeader("referer")?.split("/").slice(0,3).join("/") ?? ""; } catch {}
    const link = `${origin}/admin?reset=${token}`;
    console.log(`[admin-reset] email=${email} link=${link} expires=${expires}`);
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string().min(32).max(128),
    newPassword: z.string().min(8).max(128),
  }).parse)
  .handler(async ({ data }) => {
    const sb = admin();
    const th = hashToken(data.token);
    const { data: rows } = await sb.from("admin_password_resets" as any)
      .select("*").eq("token_hash", th).eq("used", false)
      .gte("expires_at", new Date().toISOString()).limit(1);
    const row = (rows ?? [])[0] as any;
    if (!row) throw new Error("Invalid or expired reset link");
    const hash = hashPassword(data.newPassword);
    const stored = await getStoredCreds(sb);
    if (stored) {
      await sb.from("admin_credentials" as any).update({
        password_hash: hash, updated_at: new Date().toISOString(),
      }).eq("id", 1);
    } else {
      await sb.from("admin_credentials" as any).insert({
        id: 1, email: row.email, password_hash: hash,
      });
    }
    await sb.from("admin_password_resets" as any).update({ used: true }).eq("id", row.id);
    return { ok: true };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true };
});

export const adminCheckSession = createServerFn({ method: "GET" }).handler(async () => {
  return { authed: await isLoggedIn() };
});

export const adminListGames = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isLoggedIn())) throw new Error("Not authorized");
  const sb = admin();
  const { data: games } = await sb.from("games").select("*").order("created_at", { ascending: false }).limit(200);
  const ids = (games ?? []).map((g: any) => g.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: ps } = await sb.from("players").select("game_id").in("game_id", ids);
    for (const p of ps ?? []) counts[(p as any).game_id] = (counts[(p as any).game_id] ?? 0) + 1;
  }
  return { games: (games ?? []).map((g: any) => ({ ...g, player_count: counts[g.id] ?? 0 })) };
});

export const adminGameDetails = createServerFn({ method: "GET" })
  .inputValidator(z.object({ gameId: z.string().min(1).max(32) }).parse)
  .handler(async ({ data }) => {
    if (!(await isLoggedIn())) throw new Error("Not authorized");
    const sb = admin();
    const [g, ps, an, ch] = await Promise.all([
      sb.from("games").select("*").eq("id", data.gameId).maybeSingle(),
      sb.from("players").select("*").eq("game_id", data.gameId),
      sb.from("answers").select("*").eq("game_id", data.gameId).order("round"),
      sb.from("chat_messages").select("*").eq("game_id", data.gameId).order("created_at", { ascending: false }).limit(50),
    ]);
    return { game: g.data, players: ps.data ?? [], answers: an.data ?? [], chat: ch.data ?? [] };
  });

export const adminEndGame = createServerFn({ method: "POST" })
  .inputValidator(z.object({ gameId: z.string().min(1).max(32) }).parse)
  .handler(async ({ data }) => {
    if (!(await isLoggedIn())) throw new Error("Not authorized");
    const sb = admin();
    await sb.from("games").update({ status: "ended", ended_by_admin: true } as any).eq("id", data.gameId);
    await sb.from("game_audit_log").insert({ game_id: data.gameId, event: "admin_ended", details: { at: new Date().toISOString() } });
    await sb.from("chat_messages").insert({
      game_id: data.gameId, nickname: "system",
      content: "🛑 This game has been ended by the admin. Please return to the lobby.",
      kind: "system",
    });
    return { ok: true };
  });

export const adminKickPlayer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ gameId: z.string().min(1).max(32), playerId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    if (!(await isLoggedIn())) throw new Error("Not authorized");
    const sb = admin();
    const { data: p } = await sb.from("players").select("nickname").eq("id", data.playerId).maybeSingle();
    await sb.from("players").delete().eq("id", data.playerId);
    await sb.from("chat_messages").insert({
      game_id: data.gameId, nickname: "system",
      content: `🚫 ${(p as any)?.nickname ?? "A player"} was removed by the admin.`, kind: "system",
    });
    await sb.from("game_audit_log").insert({ game_id: data.gameId, event: "admin_kick", details: { player_id: data.playerId } });
    return { ok: true };
  });

export const adminBroadcast = createServerFn({ method: "POST" })
  .inputValidator(z.object({ gameId: z.string().min(1).max(32), message: z.string().min(1).max(280) }).parse)
  .handler(async ({ data }) => {
    if (!(await isLoggedIn())) throw new Error("Not authorized");
    const sb = admin();
    await sb.from("chat_messages").insert({
      game_id: data.gameId, nickname: "admin", content: `📣 ${data.message}`, kind: "system",
    });
    return { ok: true };
  });

export const adminMutePlayer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ playerId: z.string().uuid(), muted: z.boolean() }).parse)
  .handler(async ({ data }) => {
    if (!(await isLoggedIn())) throw new Error("Not authorized");
    const sb = admin();
    await sb.from("players").update({ host_muted: data.muted } as any).eq("id", data.playerId);
    return { ok: true };
  });

export const adminListAttempts = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isLoggedIn())) throw new Error("Not authorized");
  const sb = admin();
  const { data } = await sb.from("admin_login_attempts" as any)
    .select("*").order("created_at", { ascending: false }).limit(200);
  return { attempts: data ?? [] };
});

export const adminListAuditLog = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isLoggedIn())) throw new Error("Not authorized");
  const sb = admin();
  const { data } = await sb.from("game_audit_log").select("*").order("created_at", { ascending: false }).limit(200);
  return { audit: data ?? [] };
});

export const adminListErrors = createServerFn({ method: "GET" })
  .inputValidator(z.object({ category: z.string().max(40).optional(), q: z.string().max(120).optional() }).parse)
  .handler(async ({ data }) => {
    if (!(await isLoggedIn())) throw new Error("Not authorized");
    const sb = admin();
    let q = sb.from("error_logs" as any).select("*").order("created_at", { ascending: false }).limit(300);
    if (data.category) q = q.eq("category", data.category);
    if (data.q) q = q.ilike("message", `%${data.q}%`);
    const { data: rows } = await q;
    return { errors: rows ?? [] };
  });

export const adminAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isLoggedIn())) throw new Error("Not authorized");
  const sb = admin();
  const [{ count: gamesTotal }, { count: gamesLive }, { count: playersTotal }, { count: errors24 }] = await Promise.all([
    sb.from("games").select("*", { count: "exact", head: true }),
    sb.from("games").select("*", { count: "exact", head: true }).in("status", ["lobby", "playing", "scoring", "results"]),
    sb.from("players").select("*", { count: "exact", head: true }),
    sb.from("error_logs" as any).select("*", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
  ]);
  return { gamesTotal: gamesTotal ?? 0, gamesLive: gamesLive ?? 0, playersTotal: playersTotal ?? 0, errors24: errors24 ?? 0 };
});

// Public: insert error log from frontend
export const reportClientError = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    category: z.string().max(40).default("frontend"),
    severity: z.string().max(20).default("error"),
    message: z.string().min(1).max(2000),
    stack: z.string().max(8000).optional(),
    url: z.string().max(500).optional(),
    userAgent: z.string().max(500).optional(),
    gameId: z.string().max(32).optional(),
    context: z.record(z.string(), z.any()).optional(),
  }).parse)
  .handler(async ({ data }) => {
    const sb = admin();
    await sb.from("error_logs" as any).insert({
      category: data.category, severity: data.severity, message: data.message,
      stack: data.stack ?? null, url: data.url ?? null, user_agent: data.userAgent ?? null,
      game_id: data.gameId ?? null, context: data.context ?? {},
    });
    return { ok: true };
  });
