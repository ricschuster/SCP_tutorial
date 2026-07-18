import solver, { type Model, type SolveResult } from 'javascript-lp-solver';
import { amountInUnit } from './amounts.ts';
import { attainmentFor, totalCost } from './attainment.ts';
import { checkFeasibility } from './feasibility.ts';
import type { Problem, Solution } from './types.ts';

// Exact minimum-set optimum via mixed-integer programming (a pure-JS MILP
// solver). Bounded to small instances like the teaching grid. Compare against the
// greedy heuristic to see how close greedy gets. See the solver ADR. This module
// pulls in the solver, so load it lazily (dynamic import) to keep it out of the
// initial bundle.
export function solveExact(problem: Problem): Solution {
  const feasibility = checkFeasibility(problem);
  if (!feasibility.feasible) {
    return {
      feasible: false,
      selected: [],
      totalCost: 0,
      attainment: [],
      shortfallFeatures: feasibility.shortfallFeatures,
    };
  }

  const constraints: Model['constraints'] = {};
  for (const feature of problem.features) {
    // sum over units of amount_if * x_i >= target_f
    constraints[`feat_${feature.id}`] = { min: feature.target };
  }

  const variables: Model['variables'] = {};
  const binaries: Record<string, 1> = {};

  for (const unit of problem.units) {
    if (unit.status === 'locked-out') continue; // never selectable
    const key = `u${unit.id}`;
    const coeffs: Record<string, number> = { cost: unit.cost };
    for (const feature of problem.features) {
      const amount = amountInUnit(unit, feature.id);
      if (amount !== 0) coeffs[`feat_${feature.id}`] = amount;
    }
    if (unit.status === 'locked-in') {
      // Force x_i = 1 with a per-unit equality constraint.
      const lock = `lock_${unit.id}`;
      constraints[lock] = { equal: 1 };
      coeffs[lock] = 1;
    }
    variables[key] = coeffs;
    binaries[key] = 1;
  }

  const model: Model = {
    optimize: 'cost',
    opType: 'min',
    constraints,
    variables,
    binaries,
  };
  const result = solver.Solve(model) as SolveResult;

  const selected: number[] = [];
  for (const unit of problem.units) {
    if (unit.status === 'locked-out') continue;
    const value = result[`u${unit.id}`];
    if (typeof value === 'number' && value > 0.5) selected.push(unit.id);
  }

  return {
    feasible: true,
    selected,
    totalCost: totalCost(problem, selected),
    attainment: attainmentFor(problem, selected),
    shortfallFeatures: [],
  };
}
