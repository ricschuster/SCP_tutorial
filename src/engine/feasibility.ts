import { amountInUnit } from './amounts.ts';
import { EPS } from './constants.ts';
import type { FeasibilityResult, Problem } from './types.ts';

// Amount of a feature a solution could represent: everything a solution is
// allowed to select, i.e. all units except locked-out ones.
export function selectableAmount(problem: Problem, featureId: string): number {
  let total = 0;
  for (const unit of problem.units) {
    if (unit.status === 'locked-out') continue;
    total += amountInUnit(unit, featureId);
  }
  return total;
}

// A problem is feasible only if every feature's target can be met by the
// selectable units. Returns the features that fall short.
export function checkFeasibility(problem: Problem): FeasibilityResult {
  const shortfallFeatures: string[] = [];
  for (const feature of problem.features) {
    if (selectableAmount(problem, feature.id) < feature.target - EPS) {
      shortfallFeatures.push(feature.id);
    }
  }
  return { feasible: shortfallFeatures.length === 0, shortfallFeatures };
}
