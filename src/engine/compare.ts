import type { Solution } from './types.ts';

export interface SolutionComparison {
  readonly greedyCost: number;
  readonly exactCost: number;
  // How much more the greedy solution costs than the exact optimum.
  readonly gap: number;
  readonly gapPct: number;
  // Units selected by only one of the two solutions, and by both.
  readonly onlyGreedy: readonly number[];
  readonly onlyExact: readonly number[];
  readonly both: readonly number[];
}

const asc = (a: number, b: number): number => a - b;

// Compare a greedy solution against the exact optimum: cost gap and which units
// differ. Pure; the actual solving happens elsewhere.
export function compareSolutions(
  greedy: Solution,
  exact: Solution,
): SolutionComparison {
  const g = new Set(greedy.selected);
  const e = new Set(exact.selected);
  const gap = greedy.totalCost - exact.totalCost;
  return {
    greedyCost: greedy.totalCost,
    exactCost: exact.totalCost,
    gap,
    gapPct: exact.totalCost > 0 ? (gap / exact.totalCost) * 100 : 0,
    onlyGreedy: [...g].filter((id) => !e.has(id)).sort(asc),
    onlyExact: [...e].filter((id) => !g.has(id)).sort(asc),
    both: [...g].filter((id) => e.has(id)).sort(asc),
  };
}
