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

// One LP term: a coefficient and a variable name, e.g. "3 u17".
function term(coef: number, name: string): string {
  return `${coef} ${name}`;
}
