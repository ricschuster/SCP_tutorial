// Shared shapes and helpers for talking to the HiGHS WebAssembly solver. Used by
// both the synchronous (Node/Vitest) path and the browser Web Worker, so it must
// stay free of any DOM, worker, or Node specifics.

import type { HighsSolution } from 'highs';

export interface HighsRunOptions {
  // Stop once the incumbent is provably within this fraction of optimal.
  readonly mipRelGap: number;
  // Safety cap in seconds; a pathological instance degrades to the incumbent.
  readonly timeLimitSec: number;
}

export interface HighsRunResult {
  // HiGHS model status, e.g. 'Optimal'.
  readonly status: string;
  readonly objectiveValue: number;
  // Primal value per variable name, for the variables HiGHS reports.
  readonly columns: Readonly<Record<string, number>>;
}

// Map HiGHS run options to the flat option object the solver expects. Logging is
// off so a browser solve does not spam the console.
export function highsSolveOptions(options: HighsRunOptions) {
  return {
    mip_rel_gap: options.mipRelGap,
    time_limit: options.timeLimitSec,
    output_flag: false,
  };
}

// Reduce a HiGHS solution to the plain, structured-clone-safe shape the engine
// needs, so it can cross the worker boundary via postMessage unchanged.
export function normalizeHighs(solution: HighsSolution): HighsRunResult {
  const columns: Record<string, number> = {};
  for (const [name, column] of Object.entries(solution.Columns)) {
    columns[name] = column.Primal;
  }
  return {
    status: solution.Status,
    objectiveValue: solution.ObjectiveValue,
    columns,
  };
}
