import { checkFeasibility, selectableAmount } from './feasibility.ts';
import type { PlanningUnit, Problem } from './types.ts';

function unit(
  id: number,
  amounts: Record<string, number>,
  status: PlanningUnit['status'] = 'available',
): PlanningUnit {
  return { id, cost: 1, status, amounts };
}

test('selectableAmount excludes locked-out units', () => {
  const problem: Problem = {
    units: [unit(0, { A: 5 }), unit(1, { A: 100 }, 'locked-out')],
    features: [{ id: 'A', name: 'A', target: 1 }],
  };
  expect(selectableAmount(problem, 'A')).toBe(5);
});

test('feasible when selectable amount meets every target', () => {
  const problem: Problem = {
    units: [unit(0, { A: 5, B: 1 }), unit(1, { A: 5, B: 4 })],
    features: [
      { id: 'A', name: 'A', target: 8 },
      { id: 'B', name: 'B', target: 5 },
    ],
  };
  const result = checkFeasibility(problem);
  expect(result.feasible).toBe(true);
  expect(result.shortfallFeatures).toEqual([]);
});

test('infeasible names the features that fall short', () => {
  const problem: Problem = {
    units: [unit(0, { A: 5, B: 1 }), unit(1, { A: 5, B: 1 })],
    features: [
      { id: 'A', name: 'A', target: 8 },
      { id: 'B', name: 'B', target: 5 },
    ],
  };
  const result = checkFeasibility(problem);
  expect(result.feasible).toBe(false);
  expect(result.shortfallFeatures).toEqual(['B']);
});

test('locked-in amounts count toward feasibility; locked-out never help', () => {
  const problem: Problem = {
    units: [
      unit(0, { A: 6 }, 'locked-in'),
      unit(1, { A: 5 }, 'locked-out'),
      unit(2, { A: 4 }),
    ],
    features: [{ id: 'A', name: 'A', target: 10 }],
  };
  // Selectable = locked-in (6) + available (4) = 10; locked-out (5) excluded.
  expect(checkFeasibility(problem).feasible).toBe(true);
});
