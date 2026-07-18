import type { PlanningUnit, Problem } from './types.ts';

// Amount of a feature in a single unit; a missing feature id means zero.
export function amountInUnit(unit: PlanningUnit, featureId: string): number {
  return unit.amounts[featureId] ?? 0;
}

// Total amount of a feature across the whole landscape (all units, including
// locked-out ones). This is the denominator for a fractional target.
export function totalAmount(problem: Problem, featureId: string): number {
  let total = 0;
  for (const unit of problem.units) {
    total += amountInUnit(unit, featureId);
  }
  return total;
}

// Convert a proportion (for example 0.3 for 30%) into an absolute target amount,
// as a fraction of the feature's total landscape amount.
export function targetFromFraction(
  problem: Problem,
  featureId: string,
  fraction: number,
): number {
  return totalAmount(problem, featureId) * fraction;
}
