import { compareSolutions } from './compare.ts';
import type { Solution } from './types.ts';

function solution(selected: number[], totalCost: number): Solution {
  return { feasible: true, selected, totalCost, attainment: [], shortfallFeatures: [] };
}

test('compareSolutions reports the cost gap and the selection differences', () => {
  const greedy = solution([0, 1], 6);
  const exact = solution([2], 5);
  const cmp = compareSolutions(greedy, exact);

  expect(cmp.greedyCost).toBe(6);
  expect(cmp.exactCost).toBe(5);
  expect(cmp.gap).toBe(1);
  expect(cmp.gapPct).toBeCloseTo(20);
  expect(cmp.onlyGreedy).toEqual([0, 1]);
  expect(cmp.onlyExact).toEqual([2]);
  expect(cmp.both).toEqual([]);
});

test('gapPct is zero when the exact cost is zero (nothing to select)', () => {
  const cmp = compareSolutions(solution([], 0), solution([], 0));
  expect(cmp.gap).toBe(0);
  expect(cmp.gapPct).toBe(0);
});

test('an identical solution has no gap and everything in common', () => {
  const cmp = compareSolutions(solution([1, 3], 4), solution([3, 1], 4));
  expect(cmp.gap).toBe(0);
  expect(cmp.gapPct).toBe(0);
  expect(cmp.both).toEqual([1, 3]);
  expect(cmp.onlyGreedy).toEqual([]);
  expect(cmp.onlyExact).toEqual([]);
});
