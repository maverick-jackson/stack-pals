import { describe, expect, it } from 'vitest';
import { clamp, DIMS, numberWord, Piece, shapeFor, seeded } from '../src/numbers';
import { countSteps } from '../src/count';

const value = (p: Piece) => DIMS[p.kind].value;

describe('numberWord', () => {
  it('names numbers up to one million', () => {
    expect(numberWord(0)).toBe('zero');
    expect(numberWord(7)).toBe('seven');
    expect(numberWord(13)).toBe('thirteen');
    expect(numberWord(42)).toBe('forty-two');
    expect(numberWord(100)).toBe('one hundred');
    expect(numberWord(305)).toBe('three hundred five');
    expect(numberWord(1000)).toBe('one thousand');
    expect(numberWord(2340)).toBe('two thousand three hundred forty');
    expect(numberWord(9999)).toBe('nine thousand nine hundred ninety-nine');
    expect(numberWord(40_007)).toBe('forty thousand seven');
    expect(numberWord(999_999)).toBe('nine hundred ninety-nine thousand nine hundred ninety-nine');
    expect(numberWord(1_000_000)).toBe('one million');
    for (let i = 0; i <= 1_000_000; i += 3_337) expect(numberWord(i)).toMatch(/^[a-z -]+$/);
  });
});

describe('clamp', () => {
  it('keeps numbers in 0..1,000,000', () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(2_000_000)).toBe(1_000_000);
    expect(clamp(3.6)).toBe(4);
  });
});

describe('shapeFor', () => {
  it('adds up to n with unique keys, for every number', () => {
    const ns = [...Array.from({ length: 10_000 }, (_, i) => i), ...Array.from({ length: 1000 }, (_, i) => 10_000 + i * 990), 999_999, 1_000_000];
    for (const n of ns) {
      const s = shapeFor(n);
      expect(s.pieces.reduce((a, p) => a + value(p), 0)).toBe(n);
      expect(new Set(s.pieces.map((p) => p.key)).size).toBe(s.pieces.length);
    }
  });

  it('never overlaps two pieces', () => {
    for (const n of [57, 199, 345, 999, 1234, 4567, 9999, 34_567, 999_999, 1_000_000]) {
      const s = shapeFor(n);
      const box = (p: Piece) => ({ x0: p.x, y0: p.y, x1: p.x + DIMS[p.kind].w, y1: p.y + DIMS[p.kind].h });
      for (let i = 0; i < s.pieces.length; i++) {
        for (let j = i + 1; j < s.pieces.length; j++) {
          const a = box(s.pieces[i]);
          const b = box(s.pieces[j]);
          const overlap = a.x0 < b.x1 - 1e-9 && b.x0 < a.x1 - 1e-9 && a.y0 < b.y1 - 1e-9 && b.y0 < a.y1 - 1e-9;
          expect(overlap, `${n}: ${s.pieces[i].key} vs ${s.pieces[j].key}`).toBe(false);
        }
      }
      for (const p of s.pieces) expect(box(p).x1).toBeLessThanOrEqual(s.width + 1e-9);
    }
  });

  it('is one tower up to ten', () => {
    const s = shapeFor(7);
    expect(s.width).toBe(1);
    expect(s.height).toBe(7);
    expect(s.pieces.every((p) => p.tone === 7)).toBe(true);
  });

  it('uses a cube per thousand, a flat per hundred, a column per ten', () => {
    const s = shapeFor(2345);
    expect(s.pieces.filter((p) => p.kind === 'cube').length).toBe(2);
    expect(s.pieces.filter((p) => p.kind === 'flat').length).toBe(3);
    expect(s.pieces.filter((p) => p.kind === 'block').length).toBe(45);
  });

  it('colors each place by its digit, so 20, 30, 200 and 3000 differ', () => {
    const tone = (n: number) => shapeFor(n).pieces[0].tone;
    expect([10, 20, 30, 40, 50, 60, 70, 80, 90].map(tone)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
    expect(tone(25)).toBe(20);
    expect(tone(200)).toBe(20);
    expect(tone(300)).toBe(30);
    expect(tone(3000)).toBe(30);
    const s = shapeFor(34);
    expect(s.pieces.filter((p) => p.tone === 30).length).toBe(30);
    expect(s.pieces.filter((p) => p.tone === 4).length).toBe(4);
  });

  it('builds the bigger places from rods, slabs and one giant cube', () => {
    const kinds = (n: number) => shapeFor(n).pieces.reduce<Record<string, number>>((a, p) => ((a[p.kind] = (a[p.kind] ?? 0) + 1), a), {});
    expect(kinds(234_567)).toEqual({ slab: 2, rod: 3, cube: 4, flat: 5, block: 67 });
    expect(kinds(1_000_000)).toEqual({ mega: 1 });
  });

  it('keeps tens and ones keys stable below 100 so blocks glide', () => {
    const keys = (n: number) => new Set(shapeFor(n).pieces.map((p) => p.key));
    const a = keys(47);
    for (const k of keys(46)) expect(a.has(k)).toBe(true);
  });
});

describe('countSteps', () => {
  it('counts each block up to twenty', () => {
    const steps = countSteps(12);
    expect(steps.length).toBe(12);
    expect(steps.at(-1)?.word).toBe('twelve');
    expect(steps.at(-1)?.keys).toEqual(['b1-1']);
  });

  it('counts on by place past twenty', () => {
    expect(countSteps(43).map((s) => s.word)).toEqual(['ten', 'twenty', 'thirty', 'forty', 'forty-one', 'forty-two', 'forty-three']);
    const big = countSteps(2101).map((s) => s.word);
    expect(big).toEqual(['one thousand', 'two thousand', 'two thousand one hundred', 'two thousand one hundred one']);
    expect(countSteps(110_000).map((s) => s.word)).toEqual(['one hundred thousand', 'one hundred ten thousand']);
    expect(countSteps(1_000_000).map((s) => s.word)).toEqual(['one million']);
  });

  it('only lights pieces that exist', () => {
    for (const n of [5, 17, 20, 99, 100, 1234, 9999, 56_789, 999_999, 1_000_000]) {
      const keys = new Set(shapeFor(n).pieces.map((p) => p.key));
      for (const s of countSteps(n)) for (const k of s.keys) expect(keys.has(k)).toBe(true);
    }
  });
});

describe('seeded', () => {
  it('is deterministic', () => {
    const a = seeded(5);
    const b = seeded(5);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });
});
