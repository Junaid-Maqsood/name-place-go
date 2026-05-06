// Lightweight WebAudio sound effects — no external assets.
let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  return ctx;
}

export function setMuted(v: boolean) { muted = v; }
export function isMuted() { return muted; }

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.15, delay = 0) {
  const c = getCtx();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export const sfx = {
  join: () => { tone(660, 0.12, "triangle"); tone(880, 0.18, "triangle", 0.15, 0.1); },
  start: () => { tone(523, 0.15, "square"); tone(659, 0.15, "square", 0.15, 0.12); tone(784, 0.25, "square", 0.15, 0.24); },
  end: () => { tone(440, 0.18, "sawtooth"); tone(330, 0.3, "sawtooth", 0.15, 0.18); },
  tick: () => { tone(900, 0.05, "square", 0.1); },
  fireworks: () => {
    for (let i = 0; i < 6; i++) {
      const f = 400 + Math.random() * 600;
      tone(f, 0.4, "triangle", 0.18, i * 0.18);
      tone(f * 1.5, 0.3, "sine", 0.1, i * 0.18 + 0.05);
    }
  },
};
