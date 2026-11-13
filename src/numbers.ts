export const MIN = 0;
export const MAX = 100;

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function numberWord(n: number): string {
  if (n < 20) return ONES[n];
  if (n === 100) return 'one hundred';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

export function clamp(n: number): number {
  return Math.max(MIN, Math.min(MAX, Math.round(n)));
}

export interface Tone {
  fill: string;
  shade: string;
}

// Our own palette: one tone per amount from 1 to 10, then one per decade for the full tens,
// so 20, 30 and 40 each look different. 100 wears every decade color at once.
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
  100: { fill: '#fff1a8', shade: '#e3cf6e' },
};

export function toneFor(amount: number): Tone {
  return TONES[amount];
}

export interface Cell {
  col: number;
  /** 0 is the bottom row */
  row: number;
  /** palette key: 1 to 10 for a tower or the ones, 10 to 90 by tens for full ten columns */
  tone: number;
  /** 1-based count order: tens first, bottom to top, then the ones */
  order: number;
}

export interface Shape {
  cols: number;
  rows: number;
  /** columns that are a full ten */
  tens: number;
  cells: Cell[];
}

/**
 * Up to ten: one tower. Past ten: a full column per ten, plus a shorter column for the ones,
 * so the shape itself shows place value.
 */
export function shapeFor(n: number): Shape {
  const cells: Cell[] = [];
  if (n <= 10) {
    for (let r = 0; r < n; r++) cells.push({ col: 0, row: r, tone: n, order: r + 1 });
    return { cols: n > 0 ? 1 : 0, rows: n, tens: n === 10 ? 1 : 0, cells };
  }
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  let order = 1;
  for (let c = 0; c < tens; c++) {
    const tone = n === 100 ? (c + 1) * 10 : tens * 10;
    for (let r = 0; r < 10; r++) cells.push({ col: c, row: r, tone, order: order++ });
  }
  for (let r = 0; r < ones; r++) cells.push({ col: tens, row: r, tone: ones, order: order++ });
  return { cols: tens + (ones ? 1 : 0), rows: 10, tens, cells };
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
