import { amountInUnit } from './amounts.ts';
import { attainmentFor, totalCost } from './attainment.ts';
import { EPS } from './constants.ts';
import { checkFeasibility } from './feasibility.ts';
import type { PlanningUnit, Problem, Solution } from './types.ts';

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

// Solve the minimum-set problem with a greedy marginal-gain heuristic: repeatedly
// add the available unit that reduces the remaining shortfall most per unit cost,
// until every target is met. Not guaranteed optimal (see the solver ADR); the
// exact solver arrives later. Deterministic for a given problem.
export function solve(problem: Problem): Solution {
  const feasibility = checkFeasibility(problem);
  if (!feasibility.feasible) {
    // Do not return a partial solution for an infeasible problem.
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

  // Locked-in units are always part of the solution and count toward targets.
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
        gain += Math.min(short, amountInUnit(unit, feature.id));
      }
      if (gain <= EPS) continue;
      const candidate: Candidate = { unit, score: gain / unit.cost };
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
