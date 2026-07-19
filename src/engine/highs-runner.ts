// Run a HiGHS solve on whichever path the environment supports: a Web Worker in
// the browser (off the main thread, so the UI stays responsive), or a plain
// synchronous solve under Node and Vitest (jsdom has no Worker). The worker
// client and the wasm it pulls in are dynamically imported so they never load in
// the test environment, where the sync path is used instead.

import type { HighsRunOptions, HighsRunResult } from './highs-shared.ts';

export async function runHighs(
  lp: string,
  options: HighsRunOptions,
): Promise<HighsRunResult> {
  if (typeof Worker !== 'undefined') {
    const { solveHighsInWorker } = await import('./highs-worker-client.ts');
    return solveHighsInWorker(lp, options);
  }
  const { solveHighsSync } = await import('./highs-sync.ts');
  return solveHighsSync(lp, options);
}
