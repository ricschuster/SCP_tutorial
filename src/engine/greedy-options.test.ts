import { solve } from './greedy.ts';
import type { Feature, PlanningUnit, Problem } from './types.ts';

function unit(
  id: number,
  cost: number,
  amounts: Record<string, number>,
  status: PlanningUnit['status'] = 'available',
): PlanningUnit {
  return { id, cost, status, amounts };
}

function feature(id: string, target: number): Feature {
  return { id, name: id, target };
}

test('max-coverage stays within budget and may leave targets unmet', () => {
  const problem: Problem = {
    units: [unit(0, 1, { A: 4 }), unit(1, 1, { A: 4 }), unit(2, 1, { A: 4 })],
    features: [feature('A', 10)],
  };
  const solution = solve(problem, { objective: 'max-coverage', budget: 2 });
  expect(solution.feasible).toBe(true);
  expect(solution.selected.length).toBe(2);
  expect(solution.totalCost).toBeLessThanOrEqual(2);
  expect(solution.attainment[0]?.met).toBe(false);
  expect(solution.shortfallFeatures).toEqual(['A']);
});

test('feature weights change which unit max-coverage picks first', () => {
  const problem: Problem = {
    units: [unit(0, 1, { A: 5 }), unit(1, 1, { B: 5 })],
    features: [feature('A', 5), feature('B', 5)],
  };
  // Budget of 1 forces a single pick. Unweighted, the tie breaks to the lower id.
  const flat = solve(problem, { objective: 'max-coverage', budget: 1 });
  expect(flat.selected).toEqual([0]);
  // Weighting B above A flips the choice to the B unit.
  const weighted = solve(problem, {
    objective: 'max-coverage',
    budget: 1,
    weights: { A: 1, B: 3 },
  });
  expect(weighted.selected).toEqual([1]);
});

test('boundary penalty prefers an adjacent unit over a scattered one', () => {
  // Units 0 and 2 are neighbours; unit 1 is isolated. All equal amount and cost.
  const problem: Problem = {
    units: [unit(0, 1, { A: 3 }), unit(1, 1, { A: 3 }), unit(2, 1, { A: 3 })],
    features: [feature('A', 6)],
  };
  const neighbors = new Map<number, readonly number[]>([
    [0, [2]],
    [1, []],
    [2, [0]],
  ]);

  // No penalty: unit 0 first, then the tie breaks to the lower id (unit 1).
  const flat = solve(problem);
  expect(flat.selected).toEqual([0, 1]);

  // With a penalty: after unit 0, the adjacent unit 2 is cheaper to add than the
  // isolated unit 1, so it wins despite the higher id.
  const compact = solve(problem, { boundaryPenalty: 2, neighbors });
  expect(compact.selected).toEqual([0, 2]);
});

test('connectivity penalty prefers a connected unit over a disconnected one', () => {
  // Units 0 and 2 are connected (strength 1); unit 1 is isolated. Equal amount
  // and cost, so without connectivity the tie breaks to the lower id.
  const problem: Problem = {
    units: [unit(0, 1, { A: 3 }), unit(1, 1, { A: 3 }), unit(2, 1, { A: 3 })],
    features: [feature('A', 6)],
  };
  const connectivity = new Map<number, readonly { to: number; strength: number }[]>([
    [0, [{ to: 2, strength: 1 }]],
    [1, []],
    [2, [{ to: 0, strength: 1 }]],
  ]);

  // No penalty: unit 0 first, then the tie breaks to the lower id (unit 1).
  expect(solve(problem).selected).toEqual([0, 1]);

  // With a connectivity penalty: after unit 0, unit 2 is rewarded for its link to
  // the chosen set, so it beats the isolated unit 1 despite the higher id.
  const connected = solve(problem, { connectivityPenalty: 2, connectivity });
  expect(connected.selected).toEqual([0, 2]);
});

test('connectivity penalty without a matrix has no effect', () => {
  const problem: Problem = {
    units: [unit(0, 1, { A: 3 }), unit(1, 1, { A: 3 }), unit(2, 1, { A: 3 })],
    features: [feature('A', 6)],
  };
  expect(solve(problem, { connectivityPenalty: 5 }).selected).toEqual([0, 1]);
});

test('weights do not change the min-set requirement, only the path', () => {
  const problem: Problem = {
    units: [unit(0, 1, { A: 5 }), unit(1, 1, { B: 5 })],
    features: [feature('A', 5), feature('B', 5)],
  };
  const solution = solve(problem, { weights: { A: 5, B: 1 } });
  expect(solution.feasible).toBe(true);
  expect(solution.attainment.every((a) => a.met)).toBe(true);
});
