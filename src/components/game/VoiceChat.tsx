// Lightweight WebRTC mesh voice chat using Supabase Realtime broadcast for signaling.
// Each peer initiates a connection to peers with a higher id (deterministic to avoid collisions).
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/game";
import { Mic, MicOff, Volume2, VolumeX, Headphones } from "lucide-react";
import { toast } from "sonner";

type Signal =
  | { kind: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { kind: "hello"; from: string };

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

export function VoiceChat({
  gameId,
  me,
  players,
  isHost,
}: {
  gameId: string;
  me: { playerId: string };
  players: Player[];
  isHost: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<"idle" | "asking" | "granted" | "denied">("idle");
  const [muted, setMuted] = useState(true);
  const [deafened, setDeafened] = useState(false);

  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audios = useRef<Map<string, HTMLAudioElement>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const myPlayer = players.find((p) => p.id === me.playerId);
  const hostMuted = !!myPlayer?.host_muted;

  // Effective microphone state — disabled when host-muted
  useEffect(() => {
    const stream = localStream.current;
    if (!stream) return;
    const shouldEnable = !muted && !hostMuted;
    stream.getAudioTracks().forEach((t) => (t.enabled = shouldEnable));
  }, [muted, hostMuted]);

  // Persist self-mute to DB so others can see indicator
  useEffect(() => {
    if (!enabled) return;
    supabase
      .from("players")
      .update({ voice_muted: muted || hostMuted })
      .eq("id", me.playerId);
  }, [muted, hostMuted, enabled, me.playerId]);

  const enable = async () => {
    setPermission("asking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getAudioTracks().forEach((t) => (t.enabled = false)); // start muted
      localStream.current = stream;
      setPermission("granted");
      setEnabled(true);
      setMuted(true);
      toast.success("Voice chat connected — tap mic to talk");
    } catch (e: any) {
      setPermission("denied");
      toast.error("Microphone blocked. Allow access in browser settings.");
    }
  };

  const disable = () => {
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    peers.current.forEach((pc) => pc.close());
    peers.current.clear();
    audios.current.forEach((a) => {
      a.pause();
      a.srcObject = null;
    });
    audios.current.clear();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    setEnabled(false);
  };

  // Apply deafen — mute all incoming audio elements
  useEffect(() => {
    audios.current.forEach((a) => (a.muted = deafened));
  }, [deafened]);

  // Set up signaling + peer connections when enabled
  useEffect(() => {
    if (!enabled || !localStream.current) return;
    const stream = localStream.current;
    const myId = me.playerId;

    const createPeer = (otherId: string, isInitiator: boolean) => {
      let pc = peers.current.get(otherId);
      if (pc) return pc;
      pc = new RTCPeerConnection(ICE_CONFIG);
      peers.current.set(otherId, pc);
      stream.getTracks().forEach((t) => pc!.addTrack(t, stream));

      pc.ontrack = (ev) => {
        const audio = audios.current.get(otherId) ?? new Audio();
        audio.autoplay = true;
        audio.muted = deafened;
        audio.srcObject = ev.streams[0];
        audios.current.set(otherId, audio);
        audio.play().catch(() => {});
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate && channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "signal",
            payload: { kind: "ice", from: myId, to: otherId, candidate: ev.candidate.toJSON() },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc!.connectionState === "failed" || pc!.connectionState === "closed") {
          pc!.close();
          peers.current.delete(otherId);
          const a = audios.current.get(otherId);
          if (a) {
            a.pause();
            a.srcObject = null;
            audios.current.delete(otherId);
          }
        }
      };

      if (isInitiator) {
        pc.createOffer()
          .then((offer) => pc!.setLocalDescription(offer).then(() => offer))
          .then((offer) => {
            channelRef.current?.send({
              type: "broadcast",
              event: "signal",
              payload: { kind: "offer", from: myId, to: otherId, sdp: offer },
            });
          });
      }
      return pc;
    };

    const channel = supabase.channel(`voice-${gameId}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const sig = payload as Signal;
      if (sig.kind === "hello" && sig.from !== myId) {
        // The newcomer announces; existing peers with smaller id become initiators
        if (myId < sig.from) createPeer(sig.from, true);
        return;
      }
      if (sig.from === myId) return;
      if ("to" in sig && sig.to !== myId) return;

      if (sig.kind === "offer") {
        const pc = createPeer(sig.from, false);
        await pc.setRemoteDescription(sig.sdp);
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        channel.send({
          type: "broadcast",
          event: "signal",
          payload: { kind: "answer", from: myId, to: sig.from, sdp: ans },
        });
      } else if (sig.kind === "answer") {
        const pc = peers.current.get(sig.from);
        if (pc) await pc.setRemoteDescription(sig.sdp);
      } else if (sig.kind === "ice") {
        const pc = peers.current.get(sig.from);
        if (pc) await pc.addIceCandidate(sig.candidate).catch(() => {});
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Announce presence so existing peers initiate towards us
        channel.send({
          type: "broadcast",
          event: "signal",
          payload: { kind: "hello", from: myId },
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameId, me.playerId]);

  // Tear down on unmount
  useEffect(() => {
    return () => {
      localStream.current?.getTracks().forEach((t) => t.stop());
      peers.current.forEach((pc) => pc.close());
      peers.current.clear();
    };
  }, []);

  // Host-mute action
  const toggleHostMute = async (p: Player) => {
    if (!isHost || p.id === me.playerId) return;
    await supabase.from("players").update({ host_muted: !p.host_muted }).eq("id", p.id);
    toast.success(p.host_muted ? `${p.nickname} unmuted by host` : `${p.nickname} muted by host`);
  };

  return (
    <div className="card-pop p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
          <Headphones className="size-4" /> Voice
        </h3>
        {!enabled ? (
          <button
            onClick={enable}
            disabled={permission === "asking"}
            className="btn-pop bg-primary text-primary-foreground px-3 py-1.5 text-xs"
          >
            {permission === "asking" ? "Asking…" : "Join voice"}
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMuted((m) => !m)}
              disabled={hostMuted}
              title={hostMuted ? "Muted by host" : muted ? "Unmute" : "Mute"}
              className={`btn-pop p-1.5 ${
                hostMuted ? "bg-destructive text-destructive-foreground" : muted ? "bg-card" : "bg-success text-success-foreground"
              }`}
            >
              {muted || hostMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>
            <button
              onClick={() => setDeafened((d) => !d)}
              title={deafened ? "Unmute speakers" : "Mute speakers"}
              className="btn-pop bg-card p-1.5"
            >
              {deafened ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <button onClick={disable} className="btn-pop bg-card text-xs px-2 py-1">
              Leave
            </button>
          </div>
        )}
      </div>
      {hostMuted && enabled && (
        <p className="text-xs text-destructive font-bold">You were muted by the host</p>
      )}
      {enabled && (
        <ul className="space-y-1">
          {players
            .filter((p) => !p.is_bot && p.id !== me.playerId)
            .map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 text-xs px-2 py-1 rounded-lg bg-background/60"
              >
                <span>{p.emoji}</span>
                <span className="font-bold flex-1 truncate">{p.nickname}</span>
                {p.voice_muted ? (
                  <MicOff className="size-3.5 text-muted-foreground" />
                ) : (
                  <Mic className="size-3.5 text-success" />
                )}
                {isHost && (
                  <button
                    onClick={() => toggleHostMute(p)}
                    title={p.host_muted ? "Unmute (host)" : "Mute (host)"}
                    className={`btn-pop px-2 py-0.5 text-[10px] ${
                      p.host_muted ? "bg-destructive text-destructive-foreground" : "bg-card"
                    }`}
                  >
                    {p.host_muted ? "Unmute" : "Mute"}
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
