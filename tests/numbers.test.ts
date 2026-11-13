import { describe, expect, it } from 'vitest';
import { clamp, numberWord, shapeFor, seeded } from '../src/numbers';
import { countSteps } from '../src/count';

describe('numberWord', () => {
  it('names every number from 0 to 100', () => {
    expect(numberWord(0)).toBe('zero');
    expect(numberWord(7)).toBe('seven');
    expect(numberWord(13)).toBe('thirteen');
    expect(numberWord(20)).toBe('twenty');
    expect(numberWord(42)).toBe('forty-two');
    expect(numberWord(99)).toBe('ninety-nine');
    expect(numberWord(100)).toBe('one hundred');
    for (let i = 0; i <= 100; i++) expect(numberWord(i)).toMatch(/^[a-z -]+$/);
  });
});

describe('clamp', () => {
  it('keeps numbers in 0..100', () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(130)).toBe(100);
    expect(clamp(3.6)).toBe(4);
  });
});

describe('shapeFor', () => {
  it('has exactly n blocks with unique positions', () => {
    for (let n = 0; n <= 100; n++) {
      const s = shapeFor(n);
      expect(s.cells.length).toBe(n);
      expect(new Set(s.cells.map((c) => `${c.col}-${c.row}`)).size).toBe(n);
      expect(s.cells.map((c) => c.order).sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
  });

  it('is one tower up to ten', () => {
    const s = shapeFor(7);
    expect(s.cols).toBe(1);
    expect(s.rows).toBe(7);
    expect(s.cells.every((c) => c.tone === 7)).toBe(true);
  });

  it('shows place value past ten', () => {
    const s = shapeFor(34);
    expect(s.tens).toBe(3);
    expect(s.cols).toBe(4);
    expect(s.cells.filter((c) => c.col === 3).length).toBe(4);
    expect(s.cells.filter((c) => c.tone === 30).length).toBe(30);
    expect(s.cells.filter((c) => c.tone === 4).length).toBe(4);
    expect(shapeFor(100).cols).toBe(10);
  });

  it('gives every decade its own ten color', () => {
    const tenTone = (n: number) => shapeFor(n).cells[0].tone;
    expect([10, 20, 30, 40, 50, 60, 70, 80, 90].map(tenTone)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
    expect(tenTone(25)).toBe(20);
    expect(new Set(shapeFor(100).cells.map((c) => c.tone)).size).toBe(10);
    expect(shapeFor(40).cols).toBe(4);
  });
});

describe('countSteps', () => {
  it('counts each block up to twenty', () => {
    const steps = countSteps(12);
    expect(steps.length).toBe(12);
    expect(steps.at(-1)?.word).toBe('twelve');
  });

  it('counts by tens then ones past twenty', () => {
    const words = countSteps(43).map((s) => s.word);
    expect(words).toEqual(['ten', 'twenty', 'thirty', 'forty', 'forty-one', 'forty-two', 'forty-three']);
  });
});

describe('seeded', () => {
  it('is deterministic', () => {
    const a = seeded(5);
    const b = seeded(5);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });
});
