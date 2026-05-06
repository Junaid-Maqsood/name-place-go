import { supabase } from "@/integrations/supabase/client";

export const PLAYER_EMOJIS = ["🦊","🐼","🦁","🐸","🐙","🦄","🐵","🐯","🐧","🐨","🦉","🐲","🦋","🐳"];
export const DEFAULT_CATEGORIES = ["Name","Place","Animal","Thing","Food","Movie"];
export const ALPHABET = "ABCDEFGHIJKLMNOPRSTUVW".split(""); // skip very hard letters

export type GameStatus = "lobby" | "playing" | "scoring" | "results" | "finished";

export interface Game {
  id: string;
  host_player_id: string | null;
  status: GameStatus;
  num_rounds: number;
  round_seconds: number;
  finish_countdown: number;
  categories: string[];
  current_round: number;
  current_letter: string | null;
  round_started_at: string | null;
  finish_triggered_at: string | null;
  used_letters: string[];
}

export interface Player {
  id: string;
  game_id: string;
  nickname: string;
  emoji: string;
  score: number;
  is_bot: boolean;
  finished_round: boolean;
  connected: boolean;
}

export interface Answer {
  id: string;
  game_id: string;
  round: number;
  player_id: string;
  category: string;
  value: string;
  status: "pending" | "valid" | "invalid" | "duplicate";
  points: number;
}

export function generateGameCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function pickRandomEmoji(taken: string[] = []) {
  const free = PLAYER_EMOJIS.filter((e) => !taken.includes(e));
  const pool = free.length ? free : PLAYER_EMOJIS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickLetter(used: string[]) {
  const free = ALPHABET.filter((l) => !used.includes(l));
  const pool = free.length ? free : ALPHABET;
  return pool[Math.floor(Math.random() * pool.length)];
}

const STORAGE_KEY = "npg:session";
export interface LocalSession { gameId: string; playerId: string; nickname: string; emoji: string }

export function saveSession(s: LocalSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
export function loadSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export async function createGame(nickname: string, emoji: string) {
  let code = generateGameCode();
  // try a few times in the unlikely case of collision
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase.from("games").select("id").eq("id", code).maybeSingle();
    if (!existing) break;
    code = generateGameCode();
  }
  const { error: gErr } = await supabase.from("games").insert({ id: code });
  if (gErr) throw gErr;
  const { data: player, error: pErr } = await supabase
    .from("players").insert({ game_id: code, nickname, emoji }).select().single();
  if (pErr) throw pErr;
  await supabase.from("games").update({ host_player_id: player.id }).eq("id", code);
  await supabase.from("chat_messages").insert({
    game_id: code, nickname, content: `${emoji} ${nickname} created the game`, kind: "system",
  });
  saveSession({ gameId: code, playerId: player.id, nickname, emoji });
  return { gameId: code, playerId: player.id };
}

export async function joinGame(gameId: string, nickname: string, emoji: string) {
  gameId = gameId.toUpperCase();
  const { data: game, error } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
  if (error) throw error;
  if (!game) throw new Error("Game not found");
  if (game.status !== "lobby") throw new Error("Game already in progress");
  const { count } = await supabase.from("players").select("*", { count: "exact", head: true }).eq("game_id", gameId);
  if ((count ?? 0) >= 10) throw new Error("Lobby is full (10 players max)");
  const { data: player, error: pErr } = await supabase
    .from("players").insert({ game_id: gameId, nickname, emoji }).select().single();
  if (pErr) throw pErr;
  await supabase.from("chat_messages").insert({
    game_id: gameId, nickname, content: `${emoji} ${nickname} joined`, kind: "system",
  });
  saveSession({ gameId, playerId: player.id, nickname, emoji });
  return { gameId, playerId: player.id };
}

export async function startRound(game: Game) {
  const nextRound = game.current_round + 1;
  const letter = pickLetter(game.used_letters);
  await supabase.from("players").update({ finished_round: false }).eq("game_id", game.id);
  await supabase.from("games").update({
    status: "playing",
    current_round: nextRound,
    current_letter: letter,
    round_started_at: new Date().toISOString(),
    finish_triggered_at: null,
    used_letters: [...game.used_letters, letter],
  }).eq("id", game.id);
}

export async function endRound(game: Game) {
  // Set status to scoring; the host triggers AI validation via edge function.
  await supabase.from("games").update({ status: "scoring" }).eq("id", game.id);
  const { error } = await supabase.functions.invoke("validate-round", {
    body: { gameId: game.id, round: game.current_round },
  });
  if (error) throw error;
}

export async function nextStep(game: Game) {
  if (game.current_round >= game.num_rounds) {
    await supabase.from("games").update({ status: "finished" }).eq("id", game.id);
  } else {
    await startRound(game);
  }
}

export function getTitleForPlayer(name: string, idx: number, categories: string[]) {
  const titles = [
    { emoji: "🏆", title: "Word Master" },
    { emoji: "🥈", title: "Quick Thinker" },
    { emoji: "🥉", title: "Wordsmith" },
  ];
  const fun = ["Animal Lover 🐾", "Explorer 🌍", "Word Master ✍️", "Foodie 🍕", "Cinephile 🎬"];
  return idx < 3 ? titles[idx] : { emoji: "🎉", title: fun[idx % fun.length] };
}
