export const MIN = 0;
export const MAX = 1_000_000;

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

function underThousand(n: number): string {
  const hu = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hu) parts.push(`${ONES[hu]} hundred`);
  if (rest) parts.push(underHundred(rest));
  return parts.join(' ');
}

export function numberWord(n: number): string {
  if (n === 0) return 'zero';
  if (n === 1_000_000) return 'one million';
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (th) parts.push(`${underThousand(th)} thousand`);
  if (rest) parts.push(underThousand(rest));
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

export type Kind = 'block' | 'flat' | 'cube' | 'rod' | 'slab' | 'mega';

/**
 * Every piece, in blocks: front width and height, how far it recedes, what one piece is worth,
 * and the spacing of the lines drawn on it (each piece shows the pieces it is made of).
 */
export const DIMS: Record<Kind, { w: number; h: number; d: number; value: number; step: number }> = {
  block: { w: 1, h: 1, d: 0, value: 1, step: 0 },
  flat: { w: 10, h: 10, d: 0, value: 100, step: 1 },
  cube: { w: 10, h: 10, d: 4, value: 1_000, step: 1 },
  rod: { w: 10, h: 100, d: 4, value: 10_000, step: 10 },
  slab: { w: 100, h: 100, d: 4, value: 100_000, step: 10 },
  mega: { w: 100, h: 100, d: 40, value: 1_000_000, step: 10 },
};

/** One drawn piece. Units are blocks; x from the left edge, y from the ground up. */
export interface Piece {
  key: string;
  kind: Kind;
  x: number;
  y: number;
  /** palette key: 1 to 10 for a tower or the ones, 10 to 90 for every bigger place */
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

export const GAP = 0.12; // between block columns, so each ten reads as its own stick

function digitTone(d: number): number {
  return d * 10;
}

interface Place {
  kind: Kind;
  prefix: string;
  digit: number;
  perRow: number;
  faceScale: number;
}

/**
 * Up to ten: one tower. Past ten the buddy is built the way place value is taught, and the
 * pattern repeats every three places: block, column, flat; cube, rod, slab; then one giant cube.
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

  const digit = (place: number) => Math.floor(n / place) % 10;
  const te = digit(10);
  const on = digit(1);
  const places: Place[] = [
    { kind: 'mega', prefix: 'm', digit: n >= 1_000_000 ? 1 : 0, perRow: 1, faceScale: 40 },
    { kind: 'slab', prefix: 's', digit: digit(100_000), perRow: 3, faceScale: 45 },
    { kind: 'rod', prefix: 'r', digit: digit(10_000), perRow: 9, faceScale: 6 },
    { kind: 'cube', prefix: 'c', digit: digit(1_000), perRow: 3, faceScale: 6 },
    { kind: 'flat', prefix: 'f', digit: digit(100), perRow: 3, faceScale: 5 },
  ];

  let x = 0;
  let width = 0;
  let height = 0;
  let face: Face | null = null;
  let armL = 0;
  let armR = 0;
  let armRx = 0;
  let rightFoot = 0;

  for (const p of places) {
    const count = p.digit;
    if (!count) continue;
    const { w, h, d } = DIMS[p.kind];
    const gap = 0.012 * w;
    const rows = Math.ceil(count / p.perRow);
    for (let i = 0; i < count; i++) {
      pieces.push({ key: `${p.prefix}${i}`, kind: p.kind, x: x + (i % p.perRow) * (w + gap), y: Math.floor(i / p.perRow) * h, tone: digitTone(count) });
    }
    const cols = Math.min(count, p.perRow);
    const gw = cols * (w + gap) - gap;
    const inTop = count - (rows - 1) * p.perRow;
    if (!face) {
      const grow = p.kind === 'rod' ? Math.min(1.9, 1 + 0.22 * (inTop - 1)) : 1;
      face = { x: x + (inTop * (w + gap) - gap) / 2, top: rows * h, scale: p.faceScale * grow };
      armL = rows * h * 0.5;
    }
    height = Math.max(height, rows * h + d);
    const lastColRows = Math.ceil((count - (cols - 1)) / p.perRow);
    armR = lastColRows * h * 0.5;
    armRx = x + gw + d * 0.5;
    rightFoot = x + gw - w / 2;
    width = x + gw + d;
    x = width + 0.07 * w;
  }

  // Tens and ones keep the same keys at every size, so blocks glide instead of popping.
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
    for (let r = 0; r < on; r++) pieces.push({ key: `b${te}-${r}`, kind: 'block', x, y: r, tone: on });
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
  return {
    pieces, width, height,
    face: face!,
    armL, armR, armRx,
    feet: [first.x + DIMS[first.kind].w / 2, rightFoot],
    limbs: Math.min(60, Math.max(1, height / 7)),
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
