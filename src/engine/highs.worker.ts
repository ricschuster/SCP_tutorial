// Web Worker that runs HiGHS off the main thread so the UI stays responsive
// during an exact solve. The browser build cannot locate its wasm on its own, so
// we hand it the Vite-resolved asset URL via locateFile. Under Node/Vitest this
// file is never loaded; the synchronous path (highs-sync.ts) is used instead.

import highsLoader from 'highs';
// Vite resolves the `./runtime` export of the highs package to highs.wasm and
// gives us its hashed, served URL.
import wasmUrl from 'highs/runtime?url';
import {
  highsSolveOptions,
  normalizeHighs,
  type HighsRunOptions,
  type HighsRunResult,
} from './highs-shared.ts';

interface SolveRequest {
  readonly id: number;
  readonly lp: string;
  readonly options: HighsRunOptions;
}

type SolveResponse =
  | { readonly id: number; readonly result: HighsRunResult }
  | { readonly id: number; readonly error: string };

// The default `self` type here is the DOM Window (the tsconfig uses the DOM lib,
// not WebWorker), whose postMessage signature differs from a worker's. Narrow to
// just what we use so the worker code type-checks without a lib switch.
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<SolveRequest>) => void) | null;
  postMessage: (message: SolveResponse) => void;
};

let instancePromise: ReturnType<typeof highsLoader> | null = null;

ctx.onmessage = async (event) => {
  const { id, lp, options } = event.data;
  try {
    if (instancePromise === null) {
      instancePromise = highsLoader({ locateFile: () => wasmUrl });
    }
    const highs = await instancePromise;
    const result = normalizeHighs(highs.solve(lp, highsSolveOptions(options)));
    ctx.postMessage({ id, result });
  } catch (error) {
    ctx.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
