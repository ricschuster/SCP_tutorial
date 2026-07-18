import { attainmentFor, totalCost } from './attainment.ts';
import type { PlanningUnit, Problem } from './types.ts';

function unit(id: number, cost: number, amounts: Record<string, number>): PlanningUnit {
  return { id, cost, status: 'available', amounts };
}

const problem: Problem = {
  units: [
    unit(0, 2, { A: 3, B: 0 }),
    unit(1, 5, { A: 1, B: 4 }),
    unit(2, 3, { A: 0, B: 2 }),
  ],
  features: [
    { id: 'A', name: 'A', target: 3 },
    { id: 'B', name: 'B', target: 5 },
  ],
};

test('totalCost sums the cost of the selected units only', () => {
  expect(totalCost(problem, [0, 2])).toBe(5);
  expect(totalCost(problem, [])).toBe(0);
});

test('attainmentFor reports represented amount and met/unmet per feature', () => {
  const attainment = attainmentFor(problem, [0, 2]);
  // A: unit 0 gives 3 -> meets target 3. B: units 0+2 give 0+2 = 2 -> below 5.
  expect(attainment).toEqual([
    { featureId: 'A', represented: 3, target: 3, met: true },
    { featureId: 'B', represented: 2, target: 5, met: false },
  ]);
});
