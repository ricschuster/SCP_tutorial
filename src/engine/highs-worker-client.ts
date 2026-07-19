// Main-thread client for the HiGHS Web Worker. Owns a single worker, tags each
// request with an id, and resolves the matching promise when its result returns.
// Browser only; loaded lazily by highs-runner.ts when a Worker is available.

import type { HighsRunOptions, HighsRunResult } from './highs-shared.ts';

type SolveResponse =
  { id: number; result: HighsRunResult } | { id: number; error: string };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (result: HighsRunResult) => void; reject: (error: Error) => void }
>();

function ensureWorker(): Worker {
  if (worker !== null) return worker;
  const created = new Worker(new URL('./highs.worker.ts', import.meta.url), {
    type: 'module',
  });
  created.onmessage = (event: MessageEvent<SolveResponse>) => {
    const data = event.data;
    const entry = pending.get(data.id);
    if (entry === undefined) return;
    pending.delete(data.id);
    if ('error' in data) entry.reject(new Error(data.error));
    else entry.resolve(data.result);
  };
  worker = created;
  return created;
}

export function solveHighsInWorker(
  lp: string,
  options: HighsRunOptions,
): Promise<HighsRunResult> {
  const active = ensureWorker();
  const id = nextId++;
  return new Promise<HighsRunResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    active.postMessage({ id, lp, options });
  });
}
