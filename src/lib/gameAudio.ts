// Synthesized Web Audio API feedback for VIDALORE Games Center
// Zero external audio asset dependencies, safe under SSR/jsdom/muted states.

const MUTE_KEY = "vidalore_games_sound_muted";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isGameSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setGameSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Ignore storage quota errors
  }
}

function playTone(
  freq: number,
  durationSec: number,
  type: OscillatorType = "sine",
  gainPeak = 0.08,
  delaySec = 0,
) {
  if (isGameSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const start = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + durationSec + 0.02);
  } catch {
    // Ignore Web Audio errors on restricted devices
  }
}

export const gameAudio = {
  move() {
    playTone(520, 0.08, "triangle", 0.06);
  },
  tick() {
    playTone(880, 0.04, "sine", 0.03);
  },
  correct() {
    playTone(587.33, 0.11, "triangle", 0.07, 0);
    playTone(880, 0.16, "triangle", 0.08, 0.09);
  },
  wrong() {
    playTone(240, 0.14, "sawtooth", 0.05, 0);
    playTone(185, 0.18, "sawtooth", 0.05, 0.1);
  },
  win() {
    playTone(523.25, 0.12, "triangle", 0.08, 0);
    playTone(659.25, 0.12, "triangle", 0.08, 0.09);
    playTone(783.99, 0.14, "triangle", 0.08, 0.18);
    playTone(1046.5, 0.28, "triangle", 0.09, 0.27);
  },
  melodyPreview(notes: number[]) {
    notes.forEach((freq, idx) => {
      playTone(freq, 0.22, "sine", 0.07, idx * 0.24);
    });
  },
};
