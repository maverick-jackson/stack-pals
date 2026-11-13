import './style.css';
import { B, Pal } from './character';
import { clamp, MAX, numberWord } from './numbers';
import { hush, isMuted, say, setMuted, sfx, unlockAudio } from './audio';
import { countSteps } from './count';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = document.getElementById('stage') as unknown as SVGSVGElement;
const numEl = $('num');
const wordEl = $('word');
const live = $('live');
const slider = $<HTMLInputElement>('slider');
const panel = $('panel');
const menuBtn = $<HTMLButtonElement>('menuBtn');
const countBtn = $<HTMLButtonElement>('countBtn');
const soundBtn = $<HTMLButtonElement>('soundBtn');
const fullBtn = $<HTMLButtonElement>('fullBtn');

const store = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* private mode: fine */ }
  },
};

const pal = new Pal(stage);
let n = clamp(Number(store.get('sp.n') ?? 1) || 0);

// ---- framing: big blocks for small numbers, easing out as the buddy grows ----
let view = { x: 0, y: 0, w: 1, h: 1 };
let viewAnim = 0;

function targetView() {
  const b = pal.bounds();
  const w = Math.max(b.width, 4 * B) + 2.6 * B;
  const h = Math.max(b.height, 6 * B) + 1.3 * B;
  return { x: -w / 2, y: -h + 0.3 * B, w, h };
}

function applyView(v: typeof view) {
  stage.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
}

function frame(animate: boolean) {
  const to = targetView();
  cancelAnimationFrame(viewAnim);
  if (!animate) { view = to; applyView(view); return; }
  const from = { ...view };
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / 380);
    const e = 1 - Math.pow(1 - k, 3);
    view = {
      x: from.x + (to.x - from.x) * e,
      y: from.y + (to.y - from.y) * e,
      w: from.w + (to.w - from.w) * e,
      h: from.h + (to.h - from.h) * e,
    };
    applyView(view);
    if (k < 1) viewAnim = requestAnimationFrame(step);
  };
  viewAnim = requestAnimationFrame(step);
}

stage.setAttribute('preserveAspectRatio', 'xMidYMax meet');

// ---- number changes ----
let sayTimer = 0;

function render(animate: boolean) {
  pal.set(n, animate);
  frame(animate);
  numEl.textContent = String(n);
  wordEl.textContent = numberWord(n);
  slider.value = String(n);
  live.textContent = `${n}, ${numberWord(n)}`;
  if (animate) {
    numEl.classList.remove('bump');
    void numEl.offsetWidth;
    numEl.classList.add('bump');
  }
}

function setN(next: number, opts: { speak?: boolean; quiet?: boolean } = {}) {
  next = clamp(next);
  if (next === n) {
    if (!opts.quiet) sfx.tap();
    return;
  }
  stopCount();
  const up = next > n;
  n = next;
  store.set('sp.n', String(n));
  render(true);
  if (!opts.quiet) sfx.pop(up);
  if (opts.speak !== false) {
    clearTimeout(sayTimer);
    sayTimer = window.setTimeout(() => say(numberWord(n)), 320);
  }
}

// ---- counting ----
let counting = 0; // run id; 0 means idle

function stopCount() {
  if (!counting) return;
  counting = 0;
  countBtn.classList.remove('on');
  countBtn.textContent = 'Count';
  pal.clearLights();
  hush();
}

async function runCount() {
  if (counting) { stopCount(); return; }
  if (n === 0) { say('zero. nothing to count!'); return; }
  const id = Date.now();
  counting = id;
  countBtn.classList.add('on');
  countBtn.textContent = 'Stop';
  let i = 0;
  for (const s of countSteps(n)) {
    if (counting !== id) return;
    pal.light(s.target, s.column);
    sfx.count(i++);
    say(s.word);
    await new Promise((r) => setTimeout(r, s.column ? 900 : 700));
  }
  if (counting !== id) return;
  counting = 0;
  countBtn.classList.remove('on');
  countBtn.textContent = 'Count';
  pal.jump();
  sfx.tada();
  say(`${numberWord(n)}!`);
}

// ---- input ----
function hold(btn: HTMLButtonElement, fire: () => void) {
  let delay = 0;
  let repeat = 0;
  const stop = () => {
    clearTimeout(delay);
    clearInterval(repeat);
    btn.classList.remove('held');
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    btn.classList.add('held');
    fire();
    delay = window.setTimeout(() => { repeat = window.setInterval(fire, 160); }, 450);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, stop);
  btn.addEventListener('click', (e) => {
    // keyboard activation (pointer presses were already handled on pointerdown)
    if (e.detail === 0) fire();
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((btn) => {
  const step = Number(btn.dataset.step);
  hold(btn, () => setN(n + step));
});

function setPanel(open: boolean) {
  document.body.classList.toggle('panel-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close the menu' : 'Open the menu');
  if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
  sfx.tap();
}
menuBtn.addEventListener('click', () => setPanel(!document.body.classList.contains('panel-open')));

countBtn.addEventListener('click', () => void runCount());
$('sayBtn').addEventListener('click', () => { pal.jump(); say(numberWord(n)); });
$('resetBtn').addEventListener('click', () => setN(1));
$('surpriseBtn').addEventListener('click', () => {
  let next = n;
  while (next === n) next = 1 + Math.floor(Math.random() * MAX);
  setN(next, { speak: false });
  sfx.tada();
  window.setTimeout(() => { pal.jump(); say(numberWord(n)); }, 450);
});

slider.addEventListener('input', () => setN(Number(slider.value), { quiet: true }));
slider.addEventListener('change', () => sfx.pop(true));

stage.addEventListener('pointerdown', (e) => {
  if (!(e.target as Element).closest('.pal')) return;
  pal.jump();
  sfx.boing();
  say(numberWord(n));
});

function syncSound() {
  soundBtn.setAttribute('aria-pressed', String(!isMuted()));
  soundBtn.textContent = isMuted() ? 'Sound off' : 'Sound on';
}
setMuted(store.get('sp.muted') === '1');
syncSound();
soundBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  store.set('sp.muted', isMuted() ? '1' : '0');
  syncSound();
});

type FsDoc = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };
const fsDoc = document as FsDoc;
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
if (!standalone && (document.fullscreenEnabled || fsDoc.webkitFullscreenEnabled)) {
  fullBtn.hidden = false;
  fullBtn.addEventListener('click', () => {
    const root = document.documentElement as FsEl;
    if (document.fullscreenElement || fsDoc.webkitFullscreenElement) {
      (document.exitFullscreen?.bind(document) ?? fsDoc.webkitExitFullscreen)?.();
    } else {
      (root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen)?.();
    }
  });
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '+' || e.key === '=') setN(n + 1);
  else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-') setN(n - 1);
  else if (e.key === 'Escape') setPanel(false);
});

// iOS: block pinch zoom and the double-tap zoom that still slips through.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
window.addEventListener('pointerdown', unlockAudio, { capture: true });

render(false);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js'); });
}
