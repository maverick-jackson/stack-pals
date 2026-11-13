import { numberWord } from './numbers';

export interface CountStep {
  /** piece keys to light up for this step */
  keys: string[];
  word: string;
}

const BIG: [prefix: string, value: number][] = [
  ['m', 1_000_000],
  ['s', 100_000],
  ['r', 10_000],
  ['c', 1_000],
  ['f', 100],
];

/**
 * Up to 20 we count every block. Past that we count on by place, biggest pieces first, then a
 * column at a time for the tens, then the ones ("two thousand, two thousand one hundred...").
 */
export function countSteps(n: number): CountStep[] {
  const steps: CountStep[] = [];
  if (n <= 20) {
    for (let i = 1; i <= n; i++) {
      const col = n <= 10 ? 0 : Math.floor((i - 1) / 10);
      const row = n <= 10 ? i - 1 : (i - 1) % 10;
      steps.push({ keys: [`b${col}-${row}`], word: numberWord(i) });
    }
    return steps;
  }
  let total = 0;
  for (const [prefix, value] of BIG) {
    const count = value === 1_000_000 ? Math.floor(n / value) : Math.floor(n / value) % 10;
    for (let i = 0; i < count; i++) steps.push({ keys: [`${prefix}${i}`], word: numberWord((total += value)) });
  }
  const te = Math.floor(n / 10) % 10;
  const on = n % 10;
  for (let c = 0; c < te; c++) {
    steps.push({ keys: Array.from({ length: 10 }, (_, r) => `b${c}-${r}`), word: numberWord((total += 10)) });
  }
  for (let r = 0; r < on; r++) steps.push({ keys: [`b${te}-${r}`], word: numberWord((total += 1)) });
  return steps;
}
