import { numberWord } from './numbers';

export interface CountStep {
  /** piece keys to light up for this step */
  keys: string[];
  word: string;
}

/**
 * Up to 20 we count every block. Past that we count on by place: thousands, then hundreds,
 * then a column at a time for the tens, then the ones ("two thousand, two thousand one hundred...").
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
  const th = Math.floor(n / 1000);
  const hu = Math.floor(n / 100) % 10;
  const te = Math.floor(n / 10) % 10;
  const on = n % 10;
  let total = 0;
  for (let i = 0; i < th; i++) steps.push({ keys: [`c${i}`], word: numberWord((total += 1000)) });
  for (let i = 0; i < hu; i++) steps.push({ keys: [`f${i}`], word: numberWord((total += 100)) });
  for (let c = 0; c < te; c++) {
    steps.push({ keys: Array.from({ length: 10 }, (_, r) => `b${c}-${r}`), word: numberWord((total += 10)) });
  }
  for (let r = 0; r < on; r++) steps.push({ keys: [`b${te}-${r}`], word: numberWord((total += 1)) });
  return steps;
}
