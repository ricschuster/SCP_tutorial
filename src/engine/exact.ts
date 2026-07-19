import { amountInUnit } from './amounts.ts';
import { attainmentFor, totalCost } from './attainment.ts';
import { checkFeasibility } from './feasibility.ts';
import { runHighs } from './highs-runner.ts';
import type { Problem, Solution } from './types.ts';

// Near-optimal minimum-set solution via mixed-integer programming, using HiGHS
// compiled to WebAssembly. HiGHS stops at a small proven optimality gap
// (MIP_REL_GAP), so the solve stays interactive on the teaching grid while the
// result is provably within that gap of the true optimum. Compare against the
// greedy heuristic to see how close greedy gets. See the two solver ADRs.
//
// In the browser the solve runs in a Web Worker (off the main thread); under
// Vitest it runs synchronously in-process. Both go through runHighs, which picks
// the path. This module is loaded lazily (dynamic import from the caller) so the
// solver wasm stays out of the initial bundle.
//
// GLPK (the previous engine) proved optimality too slowly once the landscape
// grew to 8 features: ~10s, hitting its time limit rather than proving optimum.
// HiGHS at a 1% gap stays well under ~1.2s across the target range. See the
// exact-solver-revisit ADR for the benchmark behind the switch.

// Stop once the incumbent is provably within 1% of optimal. Keeps the solve fast
// across the whole target range; the UI labels the result "near-optimal".
const MIP_REL_GAP = 0.01;
// Max-coverage solves to the true optimum (no gap): it is cheap here (~0.1-0.2s
// across budgets), and a gap could make the "optimum" come back below greedy at
// generous budgets, where greedy already reaches the ceiling. A negative gap
// would read as "the optimum is worse", so max-coverage pays the small cost of
// being exact.
const MAX_COVERAGE_GAP = 0;
// Safety cap: a pathological instance degrades to the incumbent instead of
// hanging. Real solves finish far inside this at the 1% gap.
const TIME_LIMIT_SEC = 10;

export async function solveExact(problem: Problem): Promise<Solution> {
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

  const lp = buildMinSetLp(problem);
  const result = await runHighs(lp, {
    mipRelGap: MIP_REL_GAP,
    timeLimitSec: TIME_LIMIT_SEC,
  });

  const selected: number[] = [];
  for (const unit of problem.units) {
    if (unit.status === 'locked-out') continue;
    const value = result.columns[`u${unit.id}`];
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

// Build the minimum-set MILP as a CPLEX-LP string for HiGHS: minimise total cost
// subject to each feature's summed coverage meeting its target, with locked-in
// units fixed to 1 and locked-out units omitted entirely. Pure and deterministic;
// all coefficients (costs, amounts) are non-negative, so terms join with " + ".
function buildMinSetLp(problem: Problem): string {
  const objectiveTerms: string[] = [];
  const binaries: string[] = [];
  const lockedIn: string[] = [];
  const featureTerms = new Map<string, string[]>();
  for (const feature of problem.features) featureTerms.set(feature.id, []);

  for (const unit of problem.units) {
    if (unit.status === 'locked-out') continue; // never selectable
    const name = `u${unit.id}`;
    objectiveTerms.push(term(unit.cost, name));
    binaries.push(name);
    for (const feature of problem.features) {
      const amount = amountInUnit(unit, feature.id);
      if (amount !== 0) featureTerms.get(feature.id)?.push(term(amount, name));
    }
    if (unit.status === 'locked-in') lockedIn.push(name);
  }

  const constraints: string[] = [];
  // sum over units of amount_if * x_i >= target_f. checkFeasibility has already
  // ruled out a feature no selectable unit supplies, so each list is non-empty.
  for (const feature of problem.features) {
    const terms = featureTerms.get(feature.id) ?? [];
    constraints.push(`  feat_${feature.id}: ${terms.join(' + ')} >= ${feature.target}`);
  }
  // Force each locked-in unit to 1.
  for (const name of lockedIn) {
    constraints.push(`  lock_${name}: ${name} = 1`);
  }

  return [
    'Minimize',
    ` cost: ${objectiveTerms.join(' + ')}`,
    'Subject To',
    ...constraints,
    'Binary',
    ` ${binaries.join(' ')}`,
    'End',
  ].join('\n');
}

// Near-optimal max-coverage solution: the set that represents the most of the
// targets (capped at each target, weighted) that fits within a cost budget. Like
// the greedy max-coverage solve, locked-in units are always included and their
// cost counts against the budget, so only the remaining budget is discretionary;
// there is no infeasibility (an empty plan is always allowed). Compare against the
// greedy max-coverage heuristic. Ignores the penalties, exactly like the min-set
// solve.
export async function solveExactMaxCoverage(
  problem: Problem,
  options: {
    budget: number;
    weights?: Readonly<Record<string, number>>;
    mipRelGap?: number;
  },
): Promise<Solution> {
  const lp = buildMaxCoverageLp(problem, options.budget, options.weights);
  const result = await runHighs(lp, {
    mipRelGap: options.mipRelGap ?? MAX_COVERAGE_GAP,
    timeLimitSec: TIME_LIMIT_SEC,
  });

  const selected: number[] = [];
  for (const unit of problem.units) {
    if (unit.status === 'locked-out') continue;
    const value = result.columns[`u${unit.id}`];
    if (typeof value === 'number' && value > 0.5) selected.push(unit.id);
  }

  const attainment = attainmentFor(problem, selected);
  return {
    feasible: true,
    selected,
    totalCost: totalCost(problem, selected),
    attainment,
    shortfallFeatures: attainment.filter((a) => !a.met).map((a) => a.featureId),
  };
}

// Build the max-coverage MILP as a CPLEX-LP string for HiGHS:
//
//   maximise  sum_f w_f * r_f
//   s.t.      r_f <= sum_i a_if x_i        (represented feature amount, capped ...)
//             0 <= r_f <= target_f         (... at the target: no credit past it)
//             sum_{i available} c_i x_i <= budget - lockedInCost
//             x_i in {0,1}; locked-in x_i = 1; locked-out omitted
//
// Locked-in units are forced in and count toward representation; their cost is
// spent up front, so only the leftover budget bounds the discretionary units,
// matching the greedy max-coverage rule. Pure and deterministic.
function buildMaxCoverageLp(
  problem: Problem,
  budget: number,
  weights?: Readonly<Record<string, number>>,
): string {
  const binaries: string[] = [];
  const lockedIn: string[] = [];
  const budgetTerms: string[] = []; // discretionary (available) units only
  const featureUnitTerms = new Map<string, string[]>();
  for (const feature of problem.features) featureUnitTerms.set(feature.id, []);
  let lockedInCost = 0;

  for (const unit of problem.units) {
    if (unit.status === 'locked-out') continue; // never selectable
    const name = `u${unit.id}`;
    binaries.push(name);
    if (unit.status === 'locked-in') {
      lockedIn.push(name);
      lockedInCost += unit.cost;
    } else {
      budgetTerms.push(term(unit.cost, name));
    }
    for (const feature of problem.features) {
      const amount = amountInUnit(unit, feature.id);
      if (amount !== 0) featureUnitTerms.get(feature.id)?.push(term(amount, name));
    }
  }

  const objectiveTerms: string[] = [];
  const constraints: string[] = [];
  const bounds: string[] = [];
  for (const feature of problem.features) {
    const rName = `r_${feature.id}`;
    objectiveTerms.push(term(weights?.[feature.id] ?? 1, rName));
    // r_f - sum a_if x_i <= 0
    const subtracted = (featureUnitTerms.get(feature.id) ?? [])
      .map((t) => `- ${t}`)
      .join(' ');
    constraints.push(
      `  cap_${feature.id}: ${rName}${subtracted ? ` ${subtracted}` : ''} <= 0`,
    );
    // Lower bound 0 is the LP default; cap the credit at the target.
    bounds.push(` ${rName} <= ${feature.target}`);
  }
  // Discretionary budget after locked-in spend. Skip the row when nothing is
  // discretionary, since an LP constraint needs at least one variable.
  if (budgetTerms.length > 0) {
    constraints.push(
      `  budget: ${budgetTerms.join(' + ')} <= ${Math.max(0, budget - lockedInCost)}`,
    );
  }
  for (const name of lockedIn) {
    constraints.push(`  lock_${name}: ${name} = 1`);
  }

  return [
    'Maximize',
    ` rep: ${objectiveTerms.join(' + ')}`,
    'Subject To',
    ...constraints,
    'Bounds',
    ...bounds,
    'Binary',
    ` ${binaries.join(' ')}`,
    'End',
  ].join('\n');
}

// One LP term: a coefficient and a variable name, e.g. "3 u17".
function term(coef: number, name: string): string {
  return `${coef} ${name}`;
}
