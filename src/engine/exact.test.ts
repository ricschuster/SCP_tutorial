import { solveExact, solveExactMaxCoverage } from './exact.ts';
import { solve } from './greedy.ts';
import { coverageValue } from './attainment.ts';
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

test('exact finds a cheaper optimum than greedy when greedy is suboptimal', async () => {
  // Greedy takes two cost-3 units (total 6); the exact optimum is the single
  // cost-5 unit that alone meets the target.
  const problem: Problem = {
    units: [unit(0, 3, { A: 6 }), unit(1, 3, { A: 6 }), unit(2, 5, { A: 10 })],
    features: [feature('A', 10)],
  };
  const greedy = solve(problem);
  const exact = await solveExact(problem);

  expect(greedy.totalCost).toBe(6);
  expect(exact.feasible).toBe(true);
  expect(exact.selected).toEqual([2]);
  expect(exact.totalCost).toBe(5);
  expect(exact.attainment.every((a) => a.met)).toBe(true);
});

test('exact respects locked-in and locked-out status', async () => {
  const problem: Problem = {
    units: [
      unit(0, 100, { A: 3 }, 'locked-in'),
      unit(1, 1, { A: 10 }),
      unit(2, 1, { A: 100 }, 'locked-out'),
    ],
    features: [feature('A', 5)],
  };
  const exact = await solveExact(problem);
  expect(exact.feasible).toBe(true);
  expect(exact.selected).toContain(0); // locked-in always selected
  expect(exact.selected).not.toContain(2); // locked-out never selected
  expect(exact.attainment[0]?.met).toBe(true);
});

test('exact reports infeasible when targets cannot be met', async () => {
  const problem: Problem = {
    units: [unit(0, 1, { A: 5 })],
    features: [feature('A', 10)],
  };
  const exact = await solveExact(problem);
  expect(exact.feasible).toBe(false);
  expect(exact.selected).toEqual([]);
  expect(exact.shortfallFeatures).toEqual(['A']);
});

test('exact max-coverage beats greedy within a budget', async () => {
  // Target is far above supply, so no capping: coverage equals represented
  // amount. Greedy grabs the best ratio unit (0) first, which strands its budget
  // on a worse pair; the optimum spends the whole budget on units 1 and 2.
  const problem: Problem = {
    units: [unit(0, 3, { A: 4 }), unit(1, 4, { A: 5 }), unit(2, 4, { A: 5 })],
    features: [feature('A', 100)],
  };
  const greedy = solve(problem, { objective: 'max-coverage', budget: 8 });
  const exact = await solveExactMaxCoverage(problem, { budget: 8 });

  expect(greedy.selected).toEqual([0, 1]);
  expect([...exact.selected].sort((a, b) => a - b)).toEqual([1, 2]);
  expect(exact.totalCost).toBeLessThanOrEqual(8);
  expect(coverageValue(exact.attainment)).toBeGreaterThan(
    coverageValue(greedy.attainment),
  );
  expect(exact.feasible).toBe(true);
});

test('exact max-coverage selects nothing with a zero budget', async () => {
  const problem: Problem = {
    units: [unit(0, 2, { A: 5 }), unit(1, 3, { A: 5 })],
    features: [feature('A', 100)],
  };
  const exact = await solveExactMaxCoverage(problem, { budget: 0 });
  expect(exact.selected).toEqual([]);
  expect(coverageValue(exact.attainment)).toBe(0);
});

test('exact max-coverage forces locked-in units in and spends leftover budget', async () => {
  const problem: Problem = {
    units: [
      unit(0, 100, { A: 5 }, 'locked-in'),
      unit(1, 1, { A: 10 }),
      unit(2, 1, { A: 3 }, 'locked-out'),
    ],
    features: [feature('A', 100)],
  };
  // Budget is far below the locked-in cost, so nothing discretionary is added,
  // but the locked-in unit is still selected and its cost is spent (as greedy
  // also does). The locked-out unit is never selected.
  const tight = await solveExactMaxCoverage(problem, { budget: 1 });
  expect(tight.selected).toEqual([0]);
  expect(tight.totalCost).toBe(100);
  expect(tight.selected).not.toContain(2);

  // With budget above the locked-in spend, the leftover buys the cheap unit 1.
  const roomy = await solveExactMaxCoverage(problem, { budget: 101 });
  expect([...roomy.selected].sort((a, b) => a - b)).toEqual([0, 1]);
});

test('exact max-coverage weights steer which units the optimum picks', async () => {
  // Equal budget for one of two units, each fully covering a different feature.
  // Weighting B above A makes the B unit the better buy.
  const problem: Problem = {
    units: [unit(0, 1, { A: 10 }), unit(1, 1, { B: 10 })],
    features: [feature('A', 10), feature('B', 10)],
  };
  const exact = await solveExactMaxCoverage(problem, {
    budget: 1,
    weights: { A: 1, B: 5 },
  });
  expect(exact.selected).toEqual([1]);
});
