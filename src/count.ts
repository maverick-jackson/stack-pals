import { numberWord } from './numbers';

export interface CountStep {
  /** block count-order, or 1-based column index when column is true */
  target: number;
  column: boolean;
  word: string;
}

/**
 * Up to 20 we count every block. Past that we count the full tens a column at a time
 * ("ten, twenty, thirty") and then the ones, which is how place value is taught.
 */
export function countSteps(n: number): CountStep[] {
  const steps: CountStep[] = [];
  if (n <= 20) {
    for (let i = 1; i <= n; i++) steps.push({ target: i, column: false, word: numberWord(i) });
    return steps;
  }
  const tens = Math.floor(n / 10);
  for (let c = 1; c <= tens; c++) steps.push({ target: c, column: true, word: numberWord(c * 10) });
  for (let i = tens * 10 + 1; i <= n; i++) steps.push({ target: i, column: false, word: numberWord(i) });
  return steps;
}
