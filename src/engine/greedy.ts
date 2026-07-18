import { amountInUnit } from './amounts.ts';
import { attainmentFor, totalCost } from './attainment.ts';
import { EPS } from './constants.ts';
import { checkFeasibility } from './feasibility.ts';
import type { PlanningUnit, Problem, Solution } from './types.ts';

export type Objective = 'min-set' | 'max-coverage';

export interface SolveOptions {
  // 'min-set' (default): cheapest set that meets every target.
  // 'max-coverage': best progress toward targets within a cost budget.
  objective?: Objective;
  // Cost ceiling for max-coverage (ignored for min-set).
  budget?: number;
  // Per-feature importance; missing features default to 1.
  weights?: Readonly<Record<string, number>>;
  // Compactness penalty (Marxan-style BLM). Needs neighbors to have an effect.
  boundaryPenalty?: number;
  // Grid adjacency: unit id -> neighbouring unit ids. Used by the penalty.
  neighbors?: ReadonlyMap<number, readonly number[]>;
}

interface Candidate {
  readonly unit: PlanningUnit;
  readonly score: number;
}

// Deterministic ordering: higher benefit-per-cost score wins; ties break to
// lower cost, then to lower unit id.
function beats(a: Candidate, b: Candidate): boolean {
  if (a.score > b.score + EPS) return true;
  if (a.score < b.score - EPS) return false;
  if (a.unit.cost < b.unit.cost - EPS) return true;
  if (a.unit.cost > b.unit.cost + EPS) return false;
  return a.unit.id < b.unit.id;
}

function weightOf(options: SolveOptions, featureId: string): number {
  return options.weights?.[featureId] ?? 1;
}

// Change in the selected set's boundary length from adding this unit: each of a
// unit's four sides adds to the boundary, and each side shared with an already
// selected neighbour removes two (one from each cell).
function boundaryDelta(
  unitId: number,
  chosen: ReadonlySet<number>,
  neighbors: ReadonlyMap<number, readonly number[]> | undefined,
): number {
  const nb = neighbors?.get(unitId);
  if (!nb) return 0;
  let adjacent = 0;
  for (const n of nb) if (chosen.has(n)) adjacent++;
  return 4 - 2 * adjacent;
}

// Cost used for scoring: the real cost plus the compactness penalty. Floored at a
// small positive value so the score stays well defined.
function scoringCost(
  unit: PlanningUnit,
  chosen: ReadonlySet<number>,
  options: SolveOptions,
): number {
  const penalty = options.boundaryPenalty ?? 0;
  if (penalty <= 0 || !options.neighbors) return unit.cost;
  return Math.max(
    EPS,
    unit.cost + penalty * boundaryDelta(unit.id, chosen, options.neighbors),
  );
}

export function solve(problem: Problem, options: SolveOptions = {}): Solution {
  return (options.objective ?? 'min-set') === 'max-coverage'
    ? solveMaxCoverage(problem, options)
    : solveMinSet(problem, options);
}

// Cheapest set of units that meets every target (greedy marginal-gain). Weights
// bias which units are chosen; the compactness penalty biases toward adjacency.
// Targets and termination use raw amounts, so weights change the path, not the
// requirement. Not guaranteed optimal (see the solver ADR).
function solveMinSet(problem: Problem, options: SolveOptions): Solution {
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

  const selected: number[] = [];
  const chosen = new Set<number>();
  const represented = new Map<string, number>();
  for (const feature of problem.features) represented.set(feature.id, 0);

  const applyUnit = (unit: PlanningUnit): void => {
    selected.push(unit.id);
    chosen.add(unit.id);
    for (const feature of problem.features) {
      represented.set(
        feature.id,
        (represented.get(feature.id) ?? 0) + amountInUnit(unit, feature.id),
      );
    }
  };

  for (const unit of problem.units) {
    if (unit.status === 'locked-in') applyUnit(unit);
  }

  const remainingShortfall = (): number => {
    let total = 0;
    for (const feature of problem.features) {
      total += Math.max(0, feature.target - (represented.get(feature.id) ?? 0));
    }
    return total;
  };

  while (remainingShortfall() > EPS) {
    let best: Candidate | null = null;
    for (const unit of problem.units) {
      if (unit.status !== 'available' || chosen.has(unit.id)) continue;
      let gain = 0;
      for (const feature of problem.features) {
        const short = Math.max(0, feature.target - (represented.get(feature.id) ?? 0));
        if (short <= EPS) continue;
        gain +=
          weightOf(options, feature.id) *
          Math.min(short, amountInUnit(unit, feature.id));
      }
      if (gain <= EPS) continue;
      const candidate: Candidate = {
        unit,
        score: gain / scoringCost(unit, chosen, options),
      };
      if (best === null || beats(candidate, best)) best = candidate;
    }
    /* v8 ignore next 2 -- unreachable once checkFeasibility has passed */
    if (best === null) break;
    applyUnit(best.unit);
  }

  return {
    feasible: true,
    selected,
    totalCost: totalCost(problem, selected),
    attainment: attainmentFor(problem, selected),
    shortfallFeatures: [],
  };
}

// Best progress toward targets within a cost budget (greedy). Locked-in units are
// always included (and count toward spend, even past the budget). Representation
// beyond a target does not count; features below target are reported as
// shortfalls. Always returns a solution.
function solveMaxCoverage(problem: Problem, options: SolveOptions): Solution {
  const budget = options.budget ?? Infinity;

  const selected: number[] = [];
  const chosen = new Set<number>();
  const represented = new Map<string, number>();
  for (const feature of problem.features) represented.set(feature.id, 0);
  let spent = 0;

  const applyUnit = (unit: PlanningUnit): void => {
    selected.push(unit.id);
    chosen.add(unit.id);
    spent += unit.cost;
    for (const feature of problem.features) {
      represented.set(
        feature.id,
        (represented.get(feature.id) ?? 0) + amountInUnit(unit, feature.id),
      );
    }
  };

  for (const unit of problem.units) {
    if (unit.status === 'locked-in') applyUnit(unit);
  }

  const gainOf = (unit: PlanningUnit): number => {
    let gain = 0;
    for (const feature of problem.features) {
      const remaining = Math.max(
        0,
        feature.target - (represented.get(feature.id) ?? 0),
      );
      if (remaining <= EPS) continue;
      gain +=
        weightOf(options, feature.id) *
        Math.min(remaining, amountInUnit(unit, feature.id));
    }
    return gain;
  };

  for (;;) {
    let best: Candidate | null = null;
    for (const unit of problem.units) {
      if (unit.status !== 'available' || chosen.has(unit.id)) continue;
      if (spent + unit.cost > budget + EPS) continue;
      const gain = gainOf(unit);
      if (gain <= EPS) continue;
      const candidate: Candidate = {
        unit,
        score: gain / scoringCost(unit, chosen, options),
      };
      if (best === null || beats(candidate, best)) best = candidate;
    }
    if (best === null) break;
    applyUnit(best.unit);
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
