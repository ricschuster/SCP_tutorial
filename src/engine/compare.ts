import { coverageValue } from './attainment.ts';
import type { Solution } from './types.ts';

// Which units two solutions select in common and which each selects alone. Shared
// by both comparison shapes and used to colour the difference map.
export interface SelectionDiff {
  readonly onlyGreedy: readonly number[];
  readonly onlyExact: readonly number[];
  readonly both: readonly number[];
}

// Minimum-set comparison: both plans meet every target, so they differ on cost.
export interface SolutionComparison extends SelectionDiff {
  readonly greedyCost: number;
  readonly exactCost: number;
  // How much more the greedy solution costs than the exact optimum.
  readonly gap: number;
  readonly gapPct: number;
}

// Max-coverage comparison: both plans fit the same budget, so they differ on how
// much of the targets they represent. Higher coverage is better.
export interface CoverageComparison extends SelectionDiff {
  readonly greedyCoverage: number;
  readonly exactCoverage: number;
  // Weighted coverage if every target were fully met: the achievable ceiling.
  readonly maxCoverage: number;
  // How much more coverage the optimum reaches than greedy (>= 0), and that gap
  // as a share of the achievable ceiling, in percentage points.
  readonly gap: number;
  readonly gapPct: number;
}

const asc = (a: number, b: number): number => a - b;

function selectionDiff(greedy: Solution, exact: Solution): SelectionDiff {
  const g = new Set(greedy.selected);
  const e = new Set(exact.selected);
  return {
    onlyGreedy: [...g].filter((id) => !e.has(id)).sort(asc),
    onlyExact: [...e].filter((id) => !g.has(id)).sort(asc),
    both: [...g].filter((id) => e.has(id)).sort(asc),
  };
}

// Compare a greedy minimum-set solution against the exact optimum: cost gap and
// which units differ. Pure; the actual solving happens elsewhere.
export function compareSolutions(
  greedy: Solution,
  exact: Solution,
): SolutionComparison {
  const gap = greedy.totalCost - exact.totalCost;
  return {
    greedyCost: greedy.totalCost,
    exactCost: exact.totalCost,
    gap,
    gapPct: exact.totalCost > 0 ? (gap / exact.totalCost) * 100 : 0,
    ...selectionDiff(greedy, exact),
  };
}

// Compare a greedy max-coverage solution against the near-optimal one: how much
// weighted, target-capped representation each reaches within the budget, and
// which units differ. Weights match the objective both solutions optimised.
export function compareCoverage(
  greedy: Solution,
  exact: Solution,
  weights?: Readonly<Record<string, number>>,
): CoverageComparison {
  const greedyCoverage = coverageValue(greedy.attainment, weights);
  const exactCoverage = coverageValue(exact.attainment, weights);
  // Achievable ceiling: every target fully met (represented = target).
  const maxCoverage = coverageValue(
    exact.attainment.map((a) => ({ ...a, represented: a.target })),
    weights,
  );
  const gap = exactCoverage - greedyCoverage;
  return {
    greedyCoverage,
    exactCoverage,
    maxCoverage,
    gap,
    gapPct: maxCoverage > 0 ? (gap / maxCoverage) * 100 : 0,
    ...selectionDiff(greedy, exact),
  };
}
