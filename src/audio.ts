// Every sound is synthesised, so there is nothing to download and nothing to decode.

type Nav = Navigator & { audioSession?: { type: string } };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function setMuted(m: boolean): void {
  muted = m;
  if (m) window.speechSynthesis?.cancel();
}

export function isMuted(): boolean {
  return muted;
}

/** Call from a user gesture. Unlocks audio on iOS and lets it play with the silent switch on. */
export function unlockAudio(): void {
  const nav = navigator as Nav;
  if (nav.audioSession) nav.audioSession.type = 'playback';
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, glideTo?: number, vol = 0.6, at = 0): void {
  if (muted || !ctx || !master) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// C major pentatonic: anything played in a row sounds pleasant.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0];

export function noteFor(step: number): number {
  const octave = Math.floor(step / SCALE.length);
  return SCALE[step % SCALE.length] * Math.pow(2, Math.min(octave, 2));
}

export const sfx = {
  pop(up: boolean) {
    tone(up ? 420 : 620, 0.12, 'sine', up ? 840 : 300, 0.5);
  },
  count(step: number) {
    tone(noteFor(step), 0.22, 'triangle', undefined, 0.55);
  },
  boing() {
    tone(220, 0.35, 'sine', 660, 0.5);
    tone(330, 0.25, 'triangle', 990, 0.18, 0.04);
  },
  tada() {
    [0, 2, 4, 7].forEach((s, i) => tone(noteFor(s), 0.3, 'triangle', undefined, 0.45, i * 0.09));
  },
  tap() {
    tone(900, 0.05, 'square', 700, 0.12);
  },
};

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): void {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  voice =
    en.find((v) => /samantha|google us english|karen|moira|tessa/i.test(v.name)) ??
    en.find((v) => v.localService) ??
    en[0] ??
    null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function say(text: string, interrupt = true): void {
  if (muted || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  if (interrupt) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-US';
  u.rate = 0.95;
  u.pitch = 1.25;
  synth.speak(u);
}

/** Speak and resolve when done (or after a sensible timeout, since onend is unreliable on some tablets). */
export function sayAndWait(text: string): Promise<void> {
  if (muted || !('speechSynthesis' in window)) return Promise.resolve();
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-US';
    u.rate = 0.95;
    u.pitch = 1.25;
    const timer = window.setTimeout(resolve, 600 + text.length * 80);
    u.onend = () => { clearTimeout(timer); resolve(); };
    u.onerror = () => { clearTimeout(timer); resolve(); };
    synth.speak(u);
  });
}

export function hush(): void {
  window.speechSynthesis?.cancel();
}
