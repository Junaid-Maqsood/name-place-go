import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function CountdownTimer({
  startedAt, durationSec, finishTriggeredAt, finishCountdown, onZero,
}: {
  startedAt: string | null; durationSec: number;
  finishTriggeredAt: string | null; finishCountdown: number;
  onZero?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt, finishTriggeredAt]);

  const { remaining, total, isFinal } = useMemo(() => {
    const startMs = startedAt ? new Date(startedAt).getTime() : now;
    const finishMs = finishTriggeredAt ? new Date(finishTriggeredAt).getTime() : null;
    if (finishMs) {
      const rem = Math.max(0, finishCountdown * 1000 - (now - finishMs));
      return { remaining: rem, total: finishCountdown * 1000, isFinal: true };
    }
    const rem = Math.max(0, durationSec * 1000 - (now - startMs));
    return { remaining: rem, total: durationSec * 1000, isFinal: false };
  }, [now, startedAt, finishTriggeredAt, durationSec, finishCountdown]);

  useEffect(() => {
    if (remaining === 0 && !fired.current) {
      fired.current = true;
      onZero?.();
    }
  }, [remaining, onZero]);

  const sec = Math.ceil(remaining / 1000);
  const pct = (remaining / total) * 100;
  const danger = sec <= 10;

  return (
    <div className="card-pop p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-display font-bold text-sm">
          {isFinal ? "⚡ FINAL COUNTDOWN" : "Time left"}
        </span>
        <AnimatePresence mode="wait">
          <motion.span key={sec}
            initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={`font-display font-bold text-2xl tabular-nums ${danger ? "text-destructive" : ""}`}>
            {sec}s
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="h-3 rounded-full bg-foreground/10 overflow-hidden border-2 border-foreground/20">
        <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.25 }}
          className={`h-full ${isFinal ? "bg-destructive" : danger ? "bg-warning" : "bg-success"}`} />
      </div>
    </div>
  );
}
