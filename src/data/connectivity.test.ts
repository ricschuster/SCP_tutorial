import {
  buildConnectivity,
  connectivityPotential,
  CONNECTIVITY_RADIUS,
} from './connectivity.ts';
import { makeWorkingUnits, SCENARIO } from './scenario.ts';

const n = SCENARIO.gridSize;

test('the connectivity matrix is symmetric', () => {
  const matrix = buildConnectivity(makeWorkingUnits());
  for (const [id, links] of matrix) {
    for (const link of links) {
      const back = matrix.get(link.to)?.find((l) => l.to === id);
      expect(back).toBeDefined();
      expect(back!.strength).toBeCloseTo(link.strength, 10);
    }
  }
});

test('links stay within the neighbourhood radius', () => {
  const matrix = buildConnectivity(makeWorkingUnits());
  // A cell well inside the grid, so the radius is not clipped by an edge.
  const id = 15 * n + 15;
  const links = matrix.get(id)!;
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    const dr = Math.floor(link.to / n) - 15;
    const dc = (link.to % n) - 15;
    expect(Math.hypot(dr, dc)).toBeLessThanOrEqual(CONNECTIVITY_RADIUS + 1e-9);
  }
});

test('strength decays with distance', () => {
  const matrix = buildConnectivity(makeWorkingUnits());
  const id = 15 * n + 15;
  const links = matrix.get(id)!;
  const strengthTo = (dr: number, dc: number): number =>
    links.find((l) => l.to === (15 + dr) * n + (15 + dc))!.strength;
  // An orthogonal neighbour (distance 1) is stronger than a distance-2 one.
  expect(strengthTo(0, 1)).toBeGreaterThan(strengthTo(0, 2));
});

test('the same-cover boost only increases strengths, and increases some', () => {
  const units = makeWorkingUnits();
  const base = buildConnectivity(units);
  const boosted = buildConnectivity(units, { sameCover: true });
  let increased = 0;
  for (const [id, links] of boosted) {
    const baseById = new Map(base.get(id)!.map((l) => [l.to, l.strength]));
    for (const link of links) {
      const before = baseById.get(link.to)!;
      expect(link.strength).toBeGreaterThanOrEqual(before - 1e-9);
      if (link.strength > before + 1e-9) increased++;
    }
  }
  expect(increased).toBeGreaterThan(0);
});

test('connectivityPotential sums each unit link strength', () => {
  const matrix = new Map([
    [
      0,
      [
        { to: 1, strength: 0.5 },
        { to: 2, strength: 0.25 },
      ],
    ],
    [1, [{ to: 0, strength: 0.5 }]],
    [2, [{ to: 0, strength: 0.25 }]],
  ]);
  const potential = connectivityPotential(matrix);
  expect(potential.get(0)).toBeCloseTo(0.75, 10);
  expect(potential.get(1)).toBeCloseTo(0.5, 10);
  expect(potential.get(2)).toBeCloseTo(0.25, 10);
});
