import { amountInUnit } from './amounts.ts';
import { EPS } from './constants.ts';
import type { FeatureAttainment, Problem } from './types.ts';

// Total cost of a set of selected units.
export function totalCost(problem: Problem, selected: readonly number[]): number {
  const chosen = new Set(selected);
  let cost = 0;
  for (const unit of problem.units) {
    if (chosen.has(unit.id)) cost += unit.cost;
  }
  return cost;
}

// Weighted coverage score: how much of each target is represented, capped at the
// target, summed with per-feature weights (missing weights default to 1). This is
// the max-coverage objective, so representation beyond a target does not count.
export function coverageValue(
  attainment: readonly FeatureAttainment[],
  weights?: Readonly<Record<string, number>>,
): number {
  let value = 0;
  for (const a of attainment) {
    const weight = weights?.[a.featureId] ?? 1;
    value += weight * Math.min(a.represented, a.target);
  }
  return value;
}

// Per-feature representation for a set of selected units, and whether each
// target is met.
export function attainmentFor(
  problem: Problem,
  selected: readonly number[],
): FeatureAttainment[] {
  const chosen = new Set(selected);
  return problem.features.map((feature) => {
    let represented = 0;
    for (const unit of problem.units) {
      if (chosen.has(unit.id)) represented += amountInUnit(unit, feature.id);
    }
    return {
      featureId: feature.id,
      represented,
      target: feature.target,
      met: represented >= feature.target - EPS,
    };
  });
}
