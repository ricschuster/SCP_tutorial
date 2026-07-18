import { amountInUnit, targetFromFraction, totalAmount } from './amounts.ts';
import type { PlanningUnit, Problem } from './types.ts';

function unit(
  id: number,
  amounts: Record<string, number>,
  status: PlanningUnit['status'] = 'available',
): PlanningUnit {
  return { id, cost: 1, status, amounts };
}

test('amountInUnit returns the amount, or zero for a missing feature', () => {
  const u = unit(0, { A: 4 });
  expect(amountInUnit(u, 'A')).toBe(4);
  expect(amountInUnit(u, 'B')).toBe(0);
});

test('totalAmount sums a feature across all units, including locked-out', () => {
  const problem: Problem = {
    units: [unit(0, { A: 2 }), unit(1, { A: 3 }), unit(2, { A: 5 }, 'locked-out')],
    features: [{ id: 'A', name: 'A', target: 1 }],
  };
  expect(totalAmount(problem, 'A')).toBe(10);
});

test('targetFromFraction is the fraction of the total landscape amount', () => {
  const problem: Problem = {
    units: [unit(0, { A: 6 }), unit(1, { A: 4 })],
    features: [{ id: 'A', name: 'A', target: 1 }],
  };
  expect(targetFromFraction(problem, 'A', 0.3)).toBeCloseTo(3);
});
