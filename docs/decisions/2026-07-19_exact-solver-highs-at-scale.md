# Exact solver: switch to HiGHS at a 1% gap for the 8-feature landscape

## Status

Accepted. Supersedes the glpk.js choice in
`2026-07-18_exact-solver-revisit-for-scale.md`.

## Context

Growing the landscape from 3 to 8 conservation features (issue #31) added feature
constraints to the 900-binary minimum-set MILP. glpk.js (GLPK via WebAssembly),
chosen in the 2026-07-18 revisit ADR, could no longer prove optimality in an
interactive budget: on the default scenario the "Compute exact optimum" solve took
~10s and returned a time-limited, not provably optimal, result (it hit its
`tmlim`). See issue #53.

That revisit ADR already anticipated this: it named HiGHS "the documented fallback
if a future need (larger instances, or a boundary/compactness term in the exact
model) outgrows GLPK." The 8-feature landscape is that need.

The prioritizr solver benchmark (https://prioritizr.net/articles/solver_benchmarks.html)
finds CBC and HiGHS the strongest open-source MILP engines and GLPK the weakest;
CBC has no maintained browser/WASM build, so HiGHS (`highs`, HiGHS compiled to
WebAssembly) is the browser-viable candidate.

### Two directions considered

1. Keep glpk.js, stop at a small MIP gap. A 1% gap makes glpk fast on the default
   scenario, but the fix does not hold across the target range (see below).
2. Switch to HiGHS at a 1% gap. Robustly fast across the range; keeps the teaching
   comparison honest as "near-optimal within 1%".

### Benchmark (900 binaries, 8 features; Node 24; 1% relative gap unless noted)

Min-set, cost (lower is better); `true-opt` is a gap-0 reference incumbent:

| target fraction | true-opt | glpk @1% | HiGHS @1% |
| --------------- | -------- | ------------------ | ----------------- |
| 0.1 | 268 | 268 in **10006 ms** | 267 in 1153 ms |
| 0.2 | 558 | 558 in 43 ms | 556 in 792 ms |
| 0.3 | 870 | 872 in 395 ms | 876 in 251 ms |
| 0.4 | 1198 | 1198 in 298 ms | 1197 in 506 ms |
| 0.5 | 1537 | 1537 in 93 ms | 1540 in 223 ms |
| 0.6 | 1896 | 1896 in 206 ms | 1900 in 214 ms |

Max-coverage, represented amount (higher is better); total cost 4459:

| budget | true-opt | glpk @1% | HiGHS @1% |
| ------ | -------- | ----------------- | ----------------- |
| 10% | 3333.1 | 3326.6 in 138 ms | 3333.0 in 295 ms |
| 20% | 4852.3 | 4850.0 in 351 ms | 4852.2 in 287 ms |
| 30-50% | 4857.6 | 4857.6 in ~30 ms | 4851.9 in ~250 ms |

Reading:

- **The MIP-gap-only fix is not enough for glpk.** At low targets (fraction 0.1)
  glpk still hits its 10s time limit even with a 1% gap: the LP bound there is too
  weak for its branch-and-bound to close, so the pathology just moves to another
  user-reachable point rather than going away. Its true-exact solve at fraction 0.3
  is also ~10s.
- **HiGHS is robust.** It stays under ~1.2s at every point (worst case 1153 ms) with
  no time-limit region. Its 1% result deviates by at most ~0.69% (min-set) and
  ~0.12% (max-coverage) from optimal, and on max-coverage it is tighter than glpk.
- HiGHS's true-exact (gap 0) solve is actually slower than glpk's here (~13s):
  proving optimality on this instance is expensive for both. The gap, not the
  solver alone, is what makes it interactive.

Both the acceptable objective loss and the wording were confirmed with the user.

## Decision

Use **HiGHS** (`highs`) for the exact minimum-set solve, stopping at a **1%
relative MIP gap** (`mip_rel_gap: 0.01`) with a 10s time-limit guard. The result is
provably within 1% of optimal, so the UI is relabelled from "exact optimum" to
"near-optimal optimum (within 1% of the true optimum)".

Because HiGHS ships only a synchronous WebAssembly build (unlike glpk.js, whose
default build ran the solve in its own web worker), run it **in a Web Worker we
own** so the solve stays off the main thread and the UI stays responsive. The
engine picks the path at run time:

- Browser (`typeof Worker !== 'undefined'`): `highs-runner.ts` lazily imports
  `highs-worker-client.ts`, which posts the LP to `highs.worker.ts`. The worker
  hands HiGHS its wasm via `locateFile` pointing at the Vite-resolved
  `highs/runtime?url` asset.
- Node / Vitest (jsdom has no Worker): `highs-runner.ts` lazily imports
  `highs-sync.ts` and solves synchronously in process. This keeps `solveExact`
  unit-testable without a browser and replaces the old `glpk.js` -> `glpk.js/node`
  Vitest alias, which is removed.

The LP is built as a CPLEX-LP string in `exact.ts` (`buildMinSetLp`), which stays
pure and unit-tested. The exact model is still pure minimum-set: it ignores the
compactness and connectivity penalties, which only steer greedy.

## Consequences

Positive:

- The near-optimal solve is interactive across the whole target range (~0.2 to
  ~1.2s), with no time-limit pathology, so the greedy-vs-optimum comparison is
  snappy again. The guided tour's compare step can auto-run the solve as a future
  follow-up (it currently points the learner at the button).
- The solve runs off the main thread via our worker, so the UI never freezes during
  a solve.
- HiGHS takes a structured LP and cleanly supports a budget-constrained max-coverage
  MILP, so an exact max-coverage comparison (not just min-set) is now feasible as a
  follow-up.
- The engine stays pure and testable: `solveExact` is exercised via the synchronous
  path under Vitest.

Negative / trade-offs:

- The reference is now "near-optimal (within 1%)", not proven-to-the-cent optimal.
  For the teaching point ("greedy is close to optimal") this is honest and
  sufficient, and the UI says so.
- We own a Web Worker plus its wasm wiring (`highs.worker.ts`,
  `highs-worker-client.ts`), where glpk.js gave the worker for free. These two files
  are browser-only, so they are verified in a real browser (Playwright) rather than
  by unit tests, and are excluded from the engine coverage gate.
- The HiGHS wasm chunk is ~1.2 MB gzipped, larger than GLPK's ~150 kB. It is
  dynamically imported (only when the learner runs the compare), so the initial
  bundle is unaffected.
- HiGHS carries more fixed per-solve overhead than GLPK on tiny instances, so a
  future MVP-scale problem would solve marginally slower; irrelevant at this scale.

## Update (both follow-ups shipped)

- The guided tour's compare step now auto-runs the solve on arrival instead of
  pointing at the button (its `TourStep.compute` flag drives `runCompare`).
- The compare panel now respects the objective toggle: with max coverage selected
  it compares greedy against a near-optimal max-coverage optimum
  (`solveExactMaxCoverage`), reporting coverage as a percentage of the achievable
  ceiling with the gap in percentage points. Both sides drop the greedy penalties,
  as min-set already did.
- Max-coverage solves to the **true optimum (gap 0)**, not the 1% gap min-set uses.
  It is cheap here (~0.1-0.2s at most budgets, ~1.4s worst case near the budget
  where all targets just become reachable). A gap would let the "optimum" come back
  slightly below greedy at generous budgets, where greedy already reaches the
  ceiling; a negative gap reads as "the optimum is worse", so max-coverage pays the
  small cost of being exact. "Near-optimal (within 1%)" still holds, since 0 <= 1%.
