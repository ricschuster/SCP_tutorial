import { EPS } from './constants.ts';
import { solve, type SolveOptions } from './greedy.ts';
import type { Problem } from './types.ts';

// Per-unit irreplaceability via Monte Carlo over cost-perturbed greedy solves.
// See docs/design/05_irreplaceability.md. Pure and deterministic (seeded), so it
// stays out of React and does not flicker as unrelated state changes.

// Defaults tuned for a teachable signal that still runs live on the 30x30 grid.
export const DEFAULT_IRREP_RUNS = 30;
export const DEFAULT_IRREP_JITTER = 0.35;
export const DEFAULT_IRREP_SEED = 0x5c9;

export interface IrreplaceabilityOptions {
  // Number of perturbed solves to average over.
  runs?: number;
  // Cost perturbation magnitude: each available unit's cost is scaled by
  // 1 + jitter * u, u uniform in [-1, 1]. 0 gives no perturbation (one plan).
  jitter?: number;
  // Seed for the perturbation RNG, so the heat is reproducible.
  seed?: number;
  // Solve options for each run, so the heat matches the current objective,
  // weights, budget, and compactness.
  solveOptions?: SolveOptions;
}

export interface IrreplaceabilityResult {
  // How many of the runs were feasible (the denominator for the frequencies).
  readonly runs: number;
  // Unit id -> selection frequency in [0, 1] across the feasible runs.
  readonly frequency: ReadonlyMap<number, number>;
}

// Small seeded PRNG (mulberry32): fast, dependency-free, good enough to spread
// the cost perturbation. Returns numbers in [0, 1).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function irreplaceability(
  problem: Problem,
  options: IrreplaceabilityOptions = {},
): IrreplaceabilityResult {
  const runs = options.runs ?? DEFAULT_IRREP_RUNS;
  const jitter = options.jitter ?? DEFAULT_IRREP_JITTER;
  const rng = mulberry32(options.seed ?? DEFAULT_IRREP_SEED);
  const solveOptions = options.solveOptions ?? {};

  const counts = new Map<number, number>();
  for (const unit of problem.units) counts.set(unit.id, 0);

  let feasibleRuns = 0;
  for (let r = 0; r < runs; r++) {
    // Perturb only selectable units; locked-in/out status flows through solve
    // unchanged, so their frequency stays 1 / 0 by construction.
    const perturbed: Problem = {
      features: problem.features,
      units: problem.units.map((unit) =>
        unit.status === 'available'
          ? { ...unit, cost: Math.max(EPS, unit.cost * (1 + jitter * (rng() * 2 - 1))) }
          : unit,
      ),
    };
    const solution = solve(perturbed, solveOptions);
    if (!solution.feasible) continue;
    feasibleRuns++;
    for (const id of solution.selected) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const frequency = new Map<number, number>();
  for (const [id, count] of counts) {
    frequency.set(id, feasibleRuns === 0 ? 0 : count / feasibleRuns);
  }
  return { runs: feasibleRuns, frequency };
}
