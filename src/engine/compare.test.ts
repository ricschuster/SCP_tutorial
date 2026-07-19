import { compareCoverage, compareSolutions } from './compare.ts';
import type { FeatureAttainment, Solution } from './types.ts';

function solution(selected: number[], totalCost: number): Solution {
  return { feasible: true, selected, totalCost, attainment: [], shortfallFeatures: [] };
}

function coverageSolution(
  selected: number[],
  attainment: FeatureAttainment[],
): Solution {
  return { feasible: true, selected, totalCost: 0, attainment, shortfallFeatures: [] };
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

test('compareCoverage reports coverage gap as a share of the achievable ceiling', () => {
  // Target 100, so no capping: coverage equals represented amount. The optimum
  // reaches 10, greedy 9, out of an achievable 100 -> a 1 point gap.
  const greedy = coverageSolution(
    [0, 1],
    [{ featureId: 'A', represented: 9, target: 100, met: false }],
  );
  const exact = coverageSolution(
    [1, 2],
    [{ featureId: 'A', represented: 10, target: 100, met: false }],
  );
  const cmp = compareCoverage(greedy, exact);

  expect(cmp.greedyCoverage).toBe(9);
  expect(cmp.exactCoverage).toBe(10);
  expect(cmp.maxCoverage).toBe(100);
  expect(cmp.gap).toBe(1);
  expect(cmp.gapPct).toBeCloseTo(1);
  expect(cmp.onlyGreedy).toEqual([0]);
  expect(cmp.onlyExact).toEqual([2]);
  expect(cmp.both).toEqual([1]);
});

test('compareCoverage weights the coverage and gap', () => {
  const greedy = coverageSolution(
    [],
    [
      { featureId: 'A', represented: 4, target: 10, met: false },
      { featureId: 'B', represented: 0, target: 10, met: false },
    ],
  );
  const exact = coverageSolution(
    [],
    [
      { featureId: 'A', represented: 4, target: 10, met: false },
      { featureId: 'B', represented: 6, target: 10, met: false },
    ],
  );
  const cmp = compareCoverage(greedy, exact, { A: 1, B: 3 });
  // greedy: 1*4 + 3*0 = 4; exact: 1*4 + 3*6 = 22; ceiling: 1*10 + 3*10 = 40.
  expect(cmp.greedyCoverage).toBe(4);
  expect(cmp.exactCoverage).toBe(22);
  expect(cmp.maxCoverage).toBe(40);
  expect(cmp.gapPct).toBeCloseTo(45); // 18/40
});
