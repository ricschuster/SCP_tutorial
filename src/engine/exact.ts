import GLPK, { type LP } from 'glpk.js';
import { amountInUnit } from './amounts.ts';
import { attainmentFor, totalCost } from './attainment.ts';
import { checkFeasibility } from './feasibility.ts';
import type { Problem, Solution } from './types.ts';

// Exact minimum-set optimum via mixed-integer programming, using GLPK compiled
// to WebAssembly (glpk.js). Bounded to small instances like the teaching grid.
// Compare against the greedy heuristic to see how close greedy gets. See the
// solver ADR. This module pulls in the solver, so load it lazily (dynamic
// import from the caller) to keep it out of the initial bundle.
//
// In the browser the default `glpk.js` export runs the solver in its own web
// worker (so the solve stays off the main thread); under Vitest it is aliased to
// the synchronous `glpk.js/node` build (see vite.config.ts). Both expose the
// same factory and model shape, and `await` works for either return type.

type Var = { name: string; coef: number };

// A single lazily-created GLPK instance, reused across solves.
let glpkPromise: ReturnType<typeof GLPK> | null = null;
function getGlpk(): ReturnType<typeof GLPK> {
  if (glpkPromise === null) glpkPromise = GLPK();
  return glpkPromise;
}

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

  const glpk = await getGlpk();

  const objectiveVars: Var[] = [];
  const binaries: string[] = [];
  const featureVars = new Map<string, Var[]>();
  for (const feature of problem.features) featureVars.set(feature.id, []);
  const lockedInNames: string[] = [];

  for (const unit of problem.units) {
    if (unit.status === 'locked-out') continue; // never selectable
    const name = `u${unit.id}`;
    objectiveVars.push({ name, coef: unit.cost });
    binaries.push(name);
    for (const feature of problem.features) {
      const amount = amountInUnit(unit, feature.id);
      if (amount !== 0) featureVars.get(feature.id)?.push({ name, coef: amount });
    }
    if (unit.status === 'locked-in') lockedInNames.push(name);
  }

  // sum over units of amount_if * x_i >= target_f
  const subjectTo: LP['subjectTo'] = problem.features.map((feature) => ({
    name: `feat_${feature.id}`,
    vars: featureVars.get(feature.id) ?? [],
    bnds: { type: glpk.GLP_LO, lb: feature.target, ub: 0 },
  }));
  // Force each locked-in unit to 1 (x_i = 1).
  for (const name of lockedInNames) {
    subjectTo.push({
      name: `lock_${name}`,
      vars: [{ name, coef: 1 }],
      bnds: { type: glpk.GLP_FX, lb: 1, ub: 1 },
    });
  }

  const result = await glpk.solve(
    {
      name: 'minset',
      objective: { direction: glpk.GLP_MIN, name: 'cost', vars: objectiveVars },
      subjectTo,
      binaries,
    },
    { msglev: glpk.GLP_MSG_OFF, presol: true, tmlim: 10, mipgap: 0 },
  );

  const values = result.result.vars;
  const selected: number[] = [];
  for (const unit of problem.units) {
    if (unit.status === 'locked-out') continue;
    const value = values[`u${unit.id}`];
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
