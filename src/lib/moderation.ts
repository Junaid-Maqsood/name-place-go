// Simple profanity filter + spam tracking
const BAD_WORDS = [
  "fuck", "shit", "bitch", "asshole", "bastard", "dick", "pussy", "cunt",
  "nigger", "nigga", "faggot", "retard", "slut", "whore", "cock", "twat",
  "motherfucker", "fucker", "douche", "wanker", "piss",
];

export function censor(text: string): string {
  let out = text;
  for (const w of BAD_WORDS) {
    const re = new RegExp(`\\b${w}\\w*`, "gi");
    out = out.replace(re, (m) => "*".repeat(m.length));
  }
  return out;
}

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BAD_WORDS.some((w) => new RegExp(`\\b${w}`, "i").test(lower));
}

interface SpamEntry { times: number[]; warned: boolean }
const spamMap = new Map<string, SpamEntry>();

// Returns 'ok' | 'warn' | 'kick'
export function trackSpam(playerId: string): "ok" | "warn" | "kick" {
  const now = Date.now();
  const entry = spamMap.get(playerId) ?? { times: [], warned: false };
  entry.times = entry.times.filter((t) => now - t < 5000);
  entry.times.push(now);
  spamMap.set(playerId, entry);
  if (entry.times.length >= 5) {
    if (entry.warned) {
      spamMap.delete(playerId);
      return "kick";
    }
    entry.warned = true;
    return "warn";
  }
  return "ok";
}
