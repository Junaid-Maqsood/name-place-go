import { motion } from "framer-motion";
import type { Player } from "@/lib/game";
import { Crown, Bot, Check } from "lucide-react";

export function PlayerList({ players, hostId, currentPlayerId, showFinished = false }: {
  players: Player[]; hostId: string | null; currentPlayerId: string; showFinished?: boolean;
}) {
  return (
    <div className="card-pop p-4 space-y-2">
      <h3 className="font-display font-bold mb-2">Players ({players.length}/10)</h3>
      <ul className="space-y-2">
        {players.map((p) => (
          <motion.li key={p.id} layout
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2 border-2 ${
              p.id === currentPlayerId ? "border-primary bg-primary/10" : "border-foreground/10 bg-background/60"
            }`}>
            <span className="text-2xl">{p.emoji}</span>
            <span className="font-bold flex-1 truncate">{p.nickname}</span>
            {p.is_bot && <Bot className="size-4 text-muted-foreground" />}
            {p.id === hostId && <Crown className="size-4 text-warning" />}
            {showFinished && p.finished_round && <Check className="size-4 text-success" />}
            <span className="font-display font-bold tabular-nums">{p.score}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
