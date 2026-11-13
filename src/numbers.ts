export const MIN = 0;
export const MAX = 9999;

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function underHundred(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

export function numberWord(n: number): string {
  if (n === 0) return 'zero';
  const parts: string[] = [];
  const th = Math.floor(n / 1000);
  const hu = Math.floor(n / 100) % 10;
  const rest = n % 100;
  if (th) parts.push(`${ONES[th]} thousand`);
  if (hu) parts.push(`${ONES[hu]} hundred`);
  if (rest) parts.push(underHundred(rest));
  return parts.join(' ');
}

export function clamp(n: number): number {
  return Math.max(MIN, Math.min(MAX, Math.round(n)));
}

export interface Tone {
  fill: string;
  shade: string;
}

// Our own palette: one tone per amount from 1 to 10 (towers and the ones), then one per digit
// for the bigger places (10 amber, 20 red, 30 purple...), shared by tens, hundreds and thousands.
const TONES: Record<number, Tone> = {
  1: { fill: '#ff8a5b', shade: '#e0663a' },
  2: { fill: '#4cc9f0', shade: '#2a9fd0' },
  3: { fill: '#b5e853', shade: '#8cc432' },
  4: { fill: '#f15bb5', shade: '#c93b91' },
  5: { fill: '#7ae582', shade: '#4fc25c' },
  6: { fill: '#9b5de5', shade: '#7a3dc4' },
  7: { fill: '#00bba7', shade: '#009484' },
  8: { fill: '#ff5d73', shade: '#d93d55' },
  9: { fill: '#4361ee', shade: '#2c46c7' },
  10: { fill: '#ffb703', shade: '#e09400' },
  20: { fill: '#e63946', shade: '#bf2533' },
  30: { fill: '#7b2cbf', shade: '#5f1d99' },
  40: { fill: '#b5651d', shade: '#8f4d12' },
  50: { fill: '#fb5607', shade: '#d04400' },
  60: { fill: '#1e88e5', shade: '#1468b8' },
  70: { fill: '#ff4fa3', shade: '#d93583' },
  80: { fill: '#9e9a2e', shade: '#7c781d' },
  90: { fill: '#adb5bd', shade: '#8a939c' },
};

export function toneFor(amount: number): Tone {
  return TONES[amount];
}

export type Kind = 'block' | 'flat' | 'cube';

/** One drawn piece. Units are blocks; x from the left edge, y from the ground up. */
export interface Piece {
  key: string;
  kind: Kind;
  x: number;
  y: number;
  /** palette key: 1 to 10 for a tower or the ones, 10 to 90 for tens, hundreds and thousands */
  tone: number;
}

export interface Face {
  /** centre of the face, in blocks from the left edge */
  x: number;
  /** top of the piece the face sits on, in blocks from the ground */
  top: number;
  scale: number;
}

export interface Shape {
  pieces: Piece[];
  width: number;
  height: number;
  face: Face;
  /** arm heights (blocks from the ground) at the left and right edges */
  armL: number;
  armR: number;
  /** right edge the right arm hangs from */
  armRx: number;
  feet: [number, number];
  /** size of the arms and feet */
  limbs: number;
}

export const GAP = 0.12; // between columns, so each ten reads as its own stick
export const GROUP_GAP = 0.7; // between thousands, hundreds, tens and ones
export const DEPTH = 4; // how far a thousand cube recedes
export const FLAT = 10; // a hundred is 10 by 10 blocks
const PER_ROW = 3;

function digitTone(d: number): number {
  return d * 10;
}

/**
 * Up to ten: one tower. Past ten the buddy is built the way place value is taught:
 * thousand cubes, then hundred flats, then a column per ten, then the ones.
 * Each place uses one color per digit, so 20, 30, 200 and 3000 all look different.
 */
export function shapeFor(n: number): Shape {
  const pieces: Piece[] = [];
  if (n <= 10) {
    for (let r = 0; r < n; r++) pieces.push({ key: `b0-${r}`, kind: 'block', x: 0, y: r, tone: n });
    const h = Math.max(1, n);
    return {
      pieces, width: 1, height: h,
      face: { x: 0.5, top: h, scale: 1 },
      armL: Math.min(h, 6) * 0.55, armR: Math.min(h, 6) * 0.55, armRx: 1,
      feet: [0.28, 0.72], limbs: 1,
    };
  }

  const th = Math.floor(n / 1000);
  const hu = Math.floor(n / 100) % 10;
  const te = Math.floor(n / 10) % 10;
  const on = n % 10;
  let x = 0;
  let height = 0;
  let face: Face | null = null;
  let armL = 0;
  let armR = 0;
  let armRx = 0;
  let rightFoot = 0;
  let width = 0;

  const grid = (count: number, kind: 'flat' | 'cube', prefix: string, digit: number) => {
    const rows = Math.ceil(count / PER_ROW);
    for (let i = 0; i < count; i++) {
      pieces.push({ key: `${prefix}${i}`, kind, x: x + (i % PER_ROW) * (FLAT + GAP), y: Math.floor(i / PER_ROW) * FLAT, tone: digitTone(digit) });
    }
    const depth = kind === 'cube' ? DEPTH : 0;
    const cols = Math.min(count, PER_ROW);
    const w = cols * (FLAT + GAP) - GAP;
    const topRow = rows - 1;
    const inTop = count - topRow * PER_ROW;
    if (!face) {
      face = { x: x + (inTop * (FLAT + GAP) - GAP) / 2, top: rows * FLAT, scale: kind === 'cube' ? 6 : 5 };
      armL = Math.min(rows * FLAT, 30) * 0.5;
    }
    height = Math.max(height, rows * FLAT + depth);
    const lastColRows = Math.ceil((count - (cols - 1)) / PER_ROW);
    armR = lastColRows * FLAT * 0.5;
    armRx = x + w + depth * 0.5;
    rightFoot = x + w - FLAT / 2;
    width = x + w + depth;
    x = width + GROUP_GAP;
  };

  if (th) grid(th, 'cube', 'c', th);
  if (hu) grid(hu, 'flat', 'f', hu);

  // Tens and ones keep the same keys as before, so blocks glide instead of popping.
  for (let c = 0; c < te; c++) {
    for (let r = 0; r < 10; r++) pieces.push({ key: `b${c}-${r}`, kind: 'block', x: x + c * (1 + GAP), y: r, tone: digitTone(te) });
  }
  if (te) {
    const w = te * (1 + GAP) - GAP;
    if (!face) {
      face = { x: x + w / 2, top: 10, scale: Math.min(1.9, 1 + 0.22 * (te - 1)) };
      armL = 6 * 0.55;
    }
    height = Math.max(height, 10);
    armR = 6 * 0.55;
    armRx = x + w;
    rightFoot = x + w - 0.5;
    width = x + w;
    x = width + GAP;
  }
  if (on) {
    const col = te; // ones stand in the next block column
    for (let r = 0; r < on; r++) pieces.push({ key: `b${col}-${r}`, kind: 'block', x, y: r, tone: on });
    if (!face) {
      face = { x: x + 0.5, top: on, scale: 1 };
      armL = Math.min(on, 6) * 0.55;
    }
    height = Math.max(height, on);
    armR = Math.min(on, 6) * 0.55;
    armRx = x + 1;
    rightFoot = x + 0.5;
    width = x + 1;
  }
  const first = pieces[0];
  const leftFoot = first.kind === 'block' ? 0.5 : FLAT / 2;
  const limbs = Math.min(5, Math.max(1, height / 7));
  return {
    pieces, width, height,
    face: face!,
    armL, armR, armRx,
    feet: [leftFoot, rightFoot], limbs,
  };
}

/** Deterministic PRNG so a block keeps the same wobble every time it is drawn. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}
