# Exact solver: revisit for the 30x30 landscape

## Status

Superseded by `2026-07-19_exact-solver-highs-at-scale.md`. The glpk.js choice held
at 3 features but not at 8: the "HiGHS remains the documented fallback if a future
need (larger instances ...) outgrows GLPK" clause in Consequences came due, and the
solver moved to HiGHS. The context and benchmark below remain the record of why
glpk.js was chosen first.

## Context

The exact minimum-set optimum initially used **javascript-lp-solver**, a pure-JS
mixed-integer programming solver (see the update section of
`2026-07-18_solver-greedy-first-ilp-later.md`). It was chosen because it runs in
the browser, in Node, and in the Vitest test environment, and it solves the MVP's
~100-variable instances instantly.

Moving to a 30x30 landscape (see the land-cover model ADR) raises the exact
instance to ~900 binaries. javascript-lp-solver is a naive branch-and-bound and is
already slow in testing; at 900 binaries it was expected to stall, and it runs on
the main thread, so it would freeze the UI.

An earlier attempt to use glpk.js (the original WebAssembly choice) was abandoned
because it "flooded a headless probe with its inlined worker source and did not
solve cleanly outside a browser," making it hard to unit-test in CI. That failure
was specifically the **worker-based browser build** run in a non-browser probe. So
testability in the Vitest/CI environment was made an explicit evaluation
criterion, not just raw speed.

Candidates evaluated:

1. **glpk.js** (GLPK via WebAssembly). Ships two builds: a synchronous
   `glpk.js/node` build (no worker) and a default browser build that runs the
   solve in its own web worker (async).
2. **highs** (HiGHS via WebAssembly, `highs-js`). Single build, synchronous
   `solve`, takes a CPLEX-LP-format string.
3. **javascript-lp-solver** (status quo).

Regardless of library, the exact solve should run off the main thread with a time
limit so the UI never freezes on a pathological instance.

## Decision

Use **glpk.js**. In the browser, import the default `glpk.js` build, which runs
the solve in its own web worker (off the main thread) and accepts a `tmlim` time
limit. Under Vitest the import is aliased to the synchronous `glpk.js/node` build
(`test.alias` in `vite.config.ts`); both expose the same factory and model shape,
and `await` works for either return type. The solver module is loaded lazily
(dynamic import from the caller) so its WebAssembly stays out of the initial
bundle. This supersedes the javascript-lp-solver decision.

### Benchmark (representative 30x30 minimum-set instance: 900 binaries, 3 feature constraints; Node 24)

| solver                | warm solve (median) | proven optimum | notes                     |
| --------------------- | ------------------- | -------------- | ------------------------- |
| **glpk.js** (`/node`) | ~18 ms              | 815            | chosen                    |
| highs (`highs-js`)    | ~420 ms             | 815            | correct, ~20x slower here |
| javascript-lp-solver  | did not finish      | -              | still running after 90 s  |

Both real solvers agree on the optimum; the status quo is unusable at this size.
glpk.js was ~20x faster than HiGHS on this small, few-constraint MILP (HiGHS
carries more per-solve presolve/parse overhead, and takes an LP string rather than
a structured model). glpk.js also matches the structured-model shape `exact.ts`
already used, so the swap was small.

CI testability was confirmed: `glpk.js/node` imports and solves cleanly under
Vitest (no worker, no hang). Browser behaviour was confirmed end-to-end: the
greedy-vs-exact panel computes via the worker build with no console errors,
returning the same optimum as before the swap (greedy 117 vs exact 101 at default
targets).

## Consequences

Positive:

- Exact solves are effectively instant at the target scale, with large headroom.
- In the browser the solve runs off the main thread for free (glpk.js's own
  worker), with a `tmlim` time limit so a pathological instance degrades to the
  incumbent rather than hanging the UI.
- The engine stays pure and testable: `solveExact` is unit-tested via the
  synchronous Node build.

Negative / trade-offs:

- Two glpk.js builds are in play (browser worker vs Node sync), reconciled by a
  Vitest alias. They wrap the same GLPK and model JSON, so behaviour is identical;
  only sync-vs-async differs, absorbed by `await`.
- `solveExact` is now async. Callers already `await` the lazy import, so the
  change was contained.
- The lazy exact chunk grew (it embeds the GLPK WebAssembly, ~150 kB gzipped). It
  is dynamically imported, so the initial bundle is unaffected.
- HiGHS remains the documented fallback if a future need (larger instances, or a
  boundary/compactness term in the exact model) outgrows GLPK.
