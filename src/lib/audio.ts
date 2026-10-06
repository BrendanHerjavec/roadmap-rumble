"use client";

/**
 * Sound, synthesised rather than sampled.
 *
 * Every cue here is generated with WebAudio oscillators and noise bursts, so
 * the repo ships no binary audio at all. For a proof of concept that matters
 * more than fidelity: there are no files to license, host, preload, or get
 * wrong, and the cues stay in tune with each other because they're built from
 * one scale.
 *
 * Browsers won't let audio start before a gesture, so the context is created
 * lazily on the first cue — which is always downstream of a click.
 */

let ctx: AudioContext | null = null;
let muted = true;

const MUTE_KEY = "roadmap-rumble:muted";

export function initAudio() {
  if (typeof window === "undefined") return;
  muted = window.localStorage.getItem(MUTE_KEY) === "1";
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* non-fatal */
  }
}

function audio(): AudioContext | null {
  if (muted || typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOpts {
  freq: number;
  /** Seconds. */
  duration: number;
  type?: OscillatorType;
  gain?: number;
  /** Slide to this frequency over the duration. */
  slideTo?: number;
  delay?: number;
}

function tone({ freq, duration, type = "sine", gain = 0.14, slideTo, delay = 0 }: ToneOpts) {
  const c = audio();
  if (!c) return;

  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);

  // A short attack and an exponential tail: percussive without clicking.
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(env).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Filtered noise burst — the impact half of a sword hit. */
function noise(duration: number, gain = 0.12, delay = 0, freq = 1400) {
  const c = audio();
  if (!c) return;

  const t0 = c.currentTime + delay;
  const frames = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Decaying white noise.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }

  const src = c.createBufferSource();
  src.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 0.8;

  const env = c.createGain();
  env.gain.value = gain;

  src.connect(filter).connect(env).connect(c.destination);
  src.start(t0);
}

/* ------------------------------------------------------------------ *
 * The cues
 * ------------------------------------------------------------------ */

/** Your ballot is in. Small, dry, confirmatory — not a reward. */
export function sfxVoteLock() {
  tone({ freq: 523.25, duration: 0.09, type: "triangle", gain: 0.1 });
  tone({ freq: 783.99, duration: 0.12, type: "triangle", gain: 0.08, delay: 0.06 });
}

/** Another player's ballot landed. Deliberately quieter than your own. */
export function sfxBallot() {
  tone({ freq: 392, duration: 0.06, type: "sine", gain: 0.05 });
}

/** The tally appears. A rising swell that lands on the reveal. */
export function sfxReveal() {
  tone({ freq: 220, duration: 0.5, type: "sawtooth", gain: 0.07, slideTo: 440 });
  tone({ freq: 330, duration: 0.34, type: "triangle", gain: 0.06, delay: 0.16 });
}

/** Steel on steel, as the champions clash. */
export function sfxClash() {
  noise(0.18, 0.16, 0, 2600);
  tone({ freq: 180, duration: 0.22, type: "square", gain: 0.09, slideTo: 90 });
}

/** A decided result. Major third up. */
export function sfxVictory() {
  tone({ freq: 523.25, duration: 0.16, type: "triangle", gain: 0.12 });
  tone({ freq: 659.25, duration: 0.16, type: "triangle", gain: 0.12, delay: 0.11 });
  tone({ freq: 783.99, duration: 0.42, type: "triangle", gain: 0.13, delay: 0.22 });
}

/**
 * The room is split. A deliberately unresolved interval — a tritone — so it
 * lands as a question rather than an answer.
 */
export function sfxContested() {
  tone({ freq: 349.23, duration: 0.5, type: "sawtooth", gain: 0.09 });
  tone({ freq: 493.88, duration: 0.5, type: "sawtooth", gain: 0.09, delay: 0.02 });
}
