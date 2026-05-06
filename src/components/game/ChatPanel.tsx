import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { censor, trackSpam } from "@/lib/moderation";
import { Send, MessageCircle } from "lucide-react";

interface ChatMsg {
  id: string;
  nickname: string;
  content: string;
  kind: string;
  created_at: string;
}

const REACTIONS = ["👏", "🔥", "😂", "🎉", "🤯", "💀"];

export function ChatPanel({ gameId, nickname, playerId }: { gameId: string; nickname: string; playerId: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("chat_messages").select("*").eq("game_id", gameId)
        .order("created_at", { ascending: true }).limit(100);
      setMessages((data ?? []) as ChatMsg[]);
    })();

    const channel = supabase
      .channel(`chat-${gameId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `game_id=eq.${gameId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as ChatMsg]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = async (content: string) => {
    if (!content.trim()) return;
    const status = trackSpam(playerId);
    if (status === "warn") {
      toast.warning("Slow down with the spam — next time you'll be kicked!");
      return;
    }
    if (status === "kick") {
      toast.error("You've been kicked for spamming");
      await supabase.from("chat_messages").insert({
        game_id: gameId, nickname: "system",
        content: `🚫 ${nickname} was kicked for spamming`, kind: "system",
      });
      await supabase.from("players").delete().eq("id", playerId);
      if (typeof window !== "undefined") {
        localStorage.removeItem("npg:session");
        window.location.href = "/";
      }
      return;
    }
    const clean = censor(content).slice(0, 200);
    await supabase.from("chat_messages").insert({ game_id: gameId, nickname, player_id: playerId, content: clean });
    setInput("");
  };

  return (
    <div className="card-pop flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-foreground/10">
        <MessageCircle className="size-4" />
        <h3 className="font-display font-bold">Chat</h3>
      </div>
      <div ref={scroller} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[180px] max-h-[40vh]">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div key={m.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={m.kind === "system" ? "text-xs text-muted-foreground italic" : "text-sm"}>
              {m.kind === "system" ? m.content : (
                <><span className="font-bold mr-1">{m.nickname}:</span><span>{m.content}</span></>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="px-3 pt-2 pb-3 border-t-2 border-foreground/10 space-y-2">
        <div className="flex gap-1 flex-wrap">
          {REACTIONS.map((r) => (
            <button key={r} type="button" onClick={() => send(r)}
              className="text-xl hover:scale-125 transition-transform">{r}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Say something…" maxLength={200}
            className="flex-1 rounded-full border-2 border-foreground/20 px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary" />
          <button type="submit" className="btn-pop bg-primary text-primary-foreground px-3 py-2">
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
