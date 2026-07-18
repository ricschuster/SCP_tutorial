import { solveExact } from './exact.ts';
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

test('exact finds a cheaper optimum than greedy when greedy is suboptimal', () => {
  // Greedy takes two cost-3 units (total 6); the exact optimum is the single
  // cost-5 unit that alone meets the target.
  const problem: Problem = {
    units: [unit(0, 3, { A: 6 }), unit(1, 3, { A: 6 }), unit(2, 5, { A: 10 })],
    features: [feature('A', 10)],
  };
  const greedy = solve(problem);
  const exact = solveExact(problem);

  expect(greedy.totalCost).toBe(6);
  expect(exact.feasible).toBe(true);
  expect(exact.selected).toEqual([2]);
  expect(exact.totalCost).toBe(5);
  expect(exact.attainment.every((a) => a.met)).toBe(true);
});

test('exact respects locked-in and locked-out status', () => {
  const problem: Problem = {
    units: [
      unit(0, 100, { A: 3 }, 'locked-in'),
      unit(1, 1, { A: 10 }),
      unit(2, 1, { A: 100 }, 'locked-out'),
    ],
    features: [feature('A', 5)],
  };
  const exact = solveExact(problem);
  expect(exact.feasible).toBe(true);
  expect(exact.selected).toContain(0); // locked-in always selected
  expect(exact.selected).not.toContain(2); // locked-out never selected
  expect(exact.attainment[0]?.met).toBe(true);
});

test('exact reports infeasible when targets cannot be met', () => {
  const problem: Problem = {
    units: [unit(0, 1, { A: 5 })],
    features: [feature('A', 10)],
  };
  const exact = solveExact(problem);
  expect(exact.feasible).toBe(false);
  expect(exact.selected).toEqual([]);
  expect(exact.shortfallFeatures).toEqual(['A']);
});
