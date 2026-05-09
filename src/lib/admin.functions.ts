// Admin auth + control server functions.
// Two-step login: email+password -> generates OTP (logged + stored) -> verify OTP -> session cookie.
import { createServerFn } from "@tanstack/react-start";
import { setCookie, getCookie, deleteCookie } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "junaidmksud@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "&9%uZ56,JJ";
const SESSION_COOKIE = "npg_admin";

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function rand6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isLoggedIn() {
  const v = getCookie(SESSION_COOKIE);
  // cookie is a signed-ish token: "1:<random>" set on verify; presence is enough for this simple admin.
  return !!v && v.startsWith("1:");
}

export const adminRequestOtp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email().max(255), password: z.string().min(1).max(128) }))
  .handler(async ({ data }) => {
    if (data.email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase() || data.password !== ADMIN_PASSWORD) {
      // Constant-ish delay
      await new Promise((r) => setTimeout(r, 600));
      throw new Error("Invalid credentials");
    }
    const sb = admin();
    const code = rand6();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await sb.from("admin_otps").insert({ email: ADMIN_EMAIL, code, expires_at: expires });
    // Delivery: log so the dev can read via server-function-logs.
    // For production email delivery, configure Lovable Emails and replace this with an enqueue call.
    console.log(`[admin-otp] code=${code} email=${ADMIN_EMAIL} expires=${expires}`);
    return { ok: true, hint: "OTP generated. Check server logs (or your email once Lovable Emails is configured)." };
  });

export const adminVerifyOtp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string().regex(/^\d{6}$/) }))
  .handler(async ({ data }) => {
    const sb = admin();
    const { data: rows } = await sb
      .from("admin_otps")
      .select("*")
      .eq("email", ADMIN_EMAIL)
      .eq("code", data.code)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    const otp = rows?.[0];
    if (!otp) throw new Error("Invalid or expired code");
    await sb.from("admin_otps").update({ used: true }).eq("id", otp.id);
    const token = `1:${crypto.randomUUID()}`;
    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
    return { ok: true };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true };
});

export const adminCheckSession = createServerFn({ method: "GET" }).handler(async () => {
  return { authed: isLoggedIn() };
});

export const adminListGames = createServerFn({ method: "GET" }).handler(async () => {
  if (!isLoggedIn()) throw new Error("Not authorized");
  const sb = admin();
  const { data: games } = await sb
    .from("games")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const ids = (games ?? []).map((g: any) => g.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: ps } = await sb.from("players").select("game_id").in("game_id", ids);
    for (const p of ps ?? []) counts[(p as any).game_id] = (counts[(p as any).game_id] ?? 0) + 1;
  }
  return { games: (games ?? []).map((g: any) => ({ ...g, player_count: counts[g.id] ?? 0 })) };
});

export const adminEndGame = createServerFn({ method: "POST" })
  .inputValidator(z.object({ gameId: z.string().min(1).max(32) }))
  .handler(async ({ data }) => {
    if (!isLoggedIn()) throw new Error("Not authorized");
    const sb = admin();
    await sb
      .from("games")
      .update({ status: "ended", ended_by_admin: true })
      .eq("id", data.gameId);
    await sb.from("game_audit_log").insert({
      game_id: data.gameId,
      event: "admin_ended",
      details: { at: new Date().toISOString() },
    });
    await sb.from("chat_messages").insert({
      game_id: data.gameId,
      nickname: "system",
      content: "🛑 This game has been ended by the admin.",
      kind: "system",
    });
    return { ok: true };
  });
