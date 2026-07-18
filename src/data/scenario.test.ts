import { solve } from '../engine/index.ts';
import {
  COST_RANGE,
  featureMax,
  featureTotal,
  SCENARIO,
  toProblem,
} from './scenario.ts';

test('scenario is a full grid with positive, varied costs', () => {
  expect(SCENARIO.units.length).toBe(SCENARIO.gridSize * SCENARIO.gridSize);
  for (const unit of SCENARIO.units) expect(unit.cost).toBeGreaterThan(0);
  expect(COST_RANGE.max).toBeGreaterThan(COST_RANGE.min);
});

test('every feature is present somewhere, with overlap and empty areas', () => {
  for (const f of SCENARIO.features) {
    expect(featureTotal(f.id)).toBeGreaterThan(0);
    expect(featureMax(f.id)).toBeGreaterThan(0);
  }
  // Some units carry more than one feature (overlap enables complementarity).
  const multi = SCENARIO.units.filter((u) => Object.keys(u.amounts).length >= 2);
  expect(multi.length).toBeGreaterThan(0);
  // Some units carry nothing (crisp regions make the tradeoffs real).
  const empty = SCENARIO.units.filter((u) => Object.keys(u.amounts).length === 0);
  expect(empty.length).toBeGreaterThan(0);
});

test('toProblem sets each target as the fraction of the feature total', () => {
  const problem = toProblem({ forest: 0.3, wetland: 0.3, grassland: 0.3 });
  for (const f of problem.features) {
    expect(f.target).toBeCloseTo(featureTotal(f.id) * 0.3);
  }
});

test('the default scenario solves feasibly at 30% targets', () => {
  const solution = solve(toProblem({ forest: 0.3, wetland: 0.3, grassland: 0.3 }));
  expect(solution.feasible).toBe(true);
  expect(solution.selected.length).toBeGreaterThan(0);
  expect(solution.attainment.every((a) => a.met)).toBe(true);
});
