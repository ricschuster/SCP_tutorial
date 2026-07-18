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

test('greedy prefers cost-efficient units over the single richest cell', () => {
  const problem: Problem = {
    units: [unit(0, 1, { A: 6 }), unit(1, 1, { A: 5 }), unit(2, 10, { A: 10 })],
    features: [feature('A', 10)],
  };
  const solution = solve(problem);
  expect(solution.feasible).toBe(true);
  // Picks the two cheap units (cost 2) rather than the richest single unit 2
  // (cost 10). Order reflects benefit-per-cost: unit 0 then unit 1.
  expect(solution.selected).toEqual([0, 1]);
  expect(solution.totalCost).toBe(2);
});

test('greedy favours a multi-feature unit (complementarity)', () => {
  const problem: Problem = {
    units: [
      unit(0, 1, { A: 3, B: 0 }),
      unit(1, 1, { A: 0, B: 3 }),
      unit(2, 1, { A: 2, B: 2 }),
    ],
    features: [feature('A', 3), feature('B', 3)],
  };
  const solution = solve(problem);
  // Unit 2 covers both features, so it has the highest first-round gain (4).
  expect(solution.selected[0]).toBe(2);
  expect(solution.feasible).toBe(true);
  expect(solution.attainment.every((a) => a.met)).toBe(true);
});

test('ties break to lower cost, then to lower id', () => {
  // Equal scores (gain/cost = 2), different cost: the cheaper unit goes first.
  const costTie: Problem = {
    units: [unit(0, 2, { A: 4 }), unit(1, 1, { A: 2 })],
    features: [feature('A', 4)],
  };
  expect(solve(costTie).selected[0]).toBe(1);

  // Identical score and cost: the lower id goes first and alone meets the target.
  const idTie: Problem = {
    units: [unit(0, 2, { A: 4 }), unit(1, 2, { A: 4 })],
    features: [feature('A', 4)],
  };
  expect(solve(idTie).selected).toEqual([0]);
});

test('locked-in units are always selected first and count toward targets', () => {
  const problem: Problem = {
    units: [unit(0, 100, { A: 3 }, 'locked-in'), unit(1, 1, { A: 5 })],
    features: [feature('A', 5)],
  };
  const solution = solve(problem);
  expect(solution.selected[0]).toBe(0);
  expect(solution.selected).toContain(1);
  expect(solution.totalCost).toBe(101);
});

test('locked-out units are never selected', () => {
  const problem: Problem = {
    units: [
      unit(0, 1, { A: 100 }, 'locked-out'),
      unit(1, 1, { A: 5 }),
      unit(2, 1, { A: 5 }),
    ],
    features: [feature('A', 10)],
  };
  const solution = solve(problem);
  expect(solution.selected).not.toContain(0);
  expect([...solution.selected].sort((a, b) => a - b)).toEqual([1, 2]);
});

test('infeasible input is reported, not returned as a partial solution', () => {
  const problem: Problem = {
    units: [unit(0, 1, { A: 5 }), unit(1, 1, { A: 100 }, 'locked-out')],
    features: [feature('A', 10)],
  };
  const solution = solve(problem);
  expect(solution.feasible).toBe(false);
  expect(solution.selected).toEqual([]);
  expect(solution.shortfallFeatures).toEqual(['A']);
});

test('a target already met by locked-in units needs no further picks', () => {
  const problem: Problem = {
    units: [unit(0, 5, { A: 10 }, 'locked-in'), unit(1, 1, { A: 5 })],
    features: [feature('A', 8)],
  };
  const solution = solve(problem);
  expect(solution.selected).toEqual([0]);
});
