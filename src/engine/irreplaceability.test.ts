import { irreplaceability } from './irreplaceability.ts';
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

test('a unit that alone holds a feature is fully irreplaceable', () => {
  // Only unit 0 has feature B, so every feasible plan must include it.
  const problem: Problem = {
    units: [unit(0, 1, { A: 5, B: 5 }), unit(1, 1, { A: 5 }), unit(2, 1, { A: 5 })],
    features: [feature('A', 5), feature('B', 5)],
  };
  const { runs, frequency } = irreplaceability(problem);
  expect(runs).toBeGreaterThan(0);
  expect(frequency.get(0)).toBe(1);
});

test('two interchangeable extra units split selection frequency', () => {
  // Feature A needs one of unit 1 or unit 2 (each equivalent); unit 0 is always
  // needed for feature B. The two swappable units should each land near 0.5 and
  // well below the essential unit.
  const problem: Problem = {
    units: [unit(0, 1, { B: 5 }), unit(1, 1, { A: 5 }), unit(2, 1, { A: 5 })],
    features: [feature('A', 5), feature('B', 5)],
  };
  const { frequency } = irreplaceability(problem, { runs: 200 });
  expect(frequency.get(0)).toBe(1);
  const f1 = frequency.get(1) ?? 0;
  const f2 = frequency.get(2) ?? 0;
  expect(f1).toBeGreaterThan(0);
  expect(f2).toBeGreaterThan(0);
  expect(f1).toBeLessThan(1);
  expect(f2).toBeLessThan(1);
  // The pair together cover the single A slot in every run.
  expect(f1 + f2).toBeCloseTo(1, 5);
});

test('locked-in is 1 and locked-out is 0 by construction', () => {
  const problem: Problem = {
    units: [
      unit(0, 1, { A: 5 }, 'locked-in'),
      unit(1, 1, { A: 5 }),
      unit(2, 1, { A: 5 }, 'locked-out'),
    ],
    features: [feature('A', 5)],
  };
  const { frequency } = irreplaceability(problem);
  expect(frequency.get(0)).toBe(1);
  expect(frequency.get(2)).toBe(0);
});

test('infeasible targets give zero runs and all-zero frequency', () => {
  const problem: Problem = {
    units: [unit(0, 1, { A: 2 })],
    features: [feature('A', 10)],
  };
  const { runs, frequency } = irreplaceability(problem);
  expect(runs).toBe(0);
  expect(frequency.get(0)).toBe(0);
});

test('is deterministic across calls with the same seed', () => {
  const problem: Problem = {
    units: [unit(0, 1, { A: 5 }), unit(1, 1, { A: 5 }), unit(2, 2, { A: 5 })],
    features: [feature('A', 5)],
  };
  const a = irreplaceability(problem);
  const b = irreplaceability(problem);
  expect([...a.frequency]).toEqual([...b.frequency]);
});

test('every unit gets a frequency entry', () => {
  const problem: Problem = {
    units: [unit(0, 1, { A: 5 }), unit(1, 1, { A: 5 })],
    features: [feature('A', 5)],
  };
  const { frequency } = irreplaceability(problem);
  expect(frequency.has(0)).toBe(true);
  expect(frequency.has(1)).toBe(true);
});
