// Synchronous, in-process HiGHS solve. Used under Node and Vitest, where there
// is no browser Web Worker. The default HiGHS wasm resolution works here (the
// glue finds highs.wasm next to itself), so no locateFile is needed.

import highsLoader from 'highs';
import {
  highsSolveOptions,
  normalizeHighs,
  type HighsRunOptions,
  type HighsRunResult,
} from './highs-shared.ts';

// One lazily-created HiGHS instance, reused across solves.
let instancePromise: ReturnType<typeof highsLoader> | null = null;

export async function solveHighsSync(
  lp: string,
  options: HighsRunOptions,
): Promise<HighsRunResult> {
  if (instancePromise === null) instancePromise = highsLoader();
  const highs = await instancePromise;
  return normalizeHighs(highs.solve(lp, highsSolveOptions(options)));
}
