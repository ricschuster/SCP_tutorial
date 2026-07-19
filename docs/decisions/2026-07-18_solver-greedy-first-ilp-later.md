# Solver: greedy heuristic first, exact ILP later

## Status

Accepted

## Context

The core of the app solves the minimum-set prioritization problem: pick the
cheapest set of planning units that meets every feature target (see
`docs/design/01_prioritization_model.md`). Real SCP tools (prioritizr, Marxan)
solve this with integer linear programming (ILP) via solvers like Gurobi or
CBC/SYMPHONY, which are not available in a client-side browser app. The audience
is newcomers, and the primary goal is building intuition, not producing an
authoritative optimum.

Options considered:

1. Greedy marginal-gain heuristic only.
2. Exact ILP from the start via a WebAssembly solver (for example glpk.js).
3. Both from day one, side by side.

## Decision

Start with a **greedy marginal-gain heuristic** as the only solver, then add an
**exact ILP solver (glpk.js / WebAssembly)** in a later milestone (the method
deep-dive, M5), where it is presented alongside greedy for a greedy-versus-optimal
comparison.

The greedy heuristic: repeatedly add the available unit with the best benefit-per-
cost toward unmet targets, with deterministic tie-breaking, until all targets are
met. Full algorithm and test cases are in the model doc.

## Consequences

Positive:

- Fast, fully client-side, deterministic, and easy to unit-test.
- Teaches complementarity and cost-efficiency directly: the heuristic visibly
  fills gaps rather than ranking cells, which is the core intuition for
  newcomers.
- No heavy dependency in the MVP; the WebAssembly solver is added only when the
  app is ready to teach optimality.

Negative / trade-offs:

- Greedy solutions are not guaranteed optimal and can be more expensive than the
  true minimum-set. This is acceptable, and later becomes a teaching feature: the
  exact solver shows how close greedy gets.
- Two solvers eventually coexist; the engine must expose a common interface so the
  UI can run either. Designed for in the model doc's "later objectives and knobs".
- Adding an exact solver later brings a dependency and bounds it to small
  instances; both are acceptable given the synthetic, small-grid scope.

## Update (2026-07-18): exact solver library

When M5b landed, the exact solver was implemented with **javascript-lp-solver**
(a pure-JS mixed-integer programming solver) rather than the glpk.js /
WebAssembly option named above.

Why the change:

- glpk.js v5 is worker/WebAssembly-oriented; it is awkward to unit-test in the CI
  environment and adds integration friction under the build tool. It flooded a
  headless probe with its inlined worker source and did not solve cleanly outside
  a browser.
- javascript-lp-solver is pure JavaScript: it runs in the browser, in Node, and in
  the Vitest test environment, so the exact solver is unit-tested like the rest of
  the engine. It handles the small binary min-set instances (about 100 variables,
  a few constraints) instantly.
- It is still loaded lazily (dynamic import) so it stays out of the initial
  bundle, matching the original intent.

The decision to offer greedy-first with an exact optimum for comparison is
unchanged; only the library differs.

## Update (2026-07-18): exact solver superseded by glpk.js

Preparing for the 30x30 landscape, javascript-lp-solver was found to stall at
~900 binaries. A benchmark of glpk.js, HiGHS (`highs-js`), and javascript-lp-solver
led to adopting **glpk.js** (its synchronous Node build for tests, its worker build
in the browser). The earlier CI-test problem was the worker build run outside a
browser; the `glpk.js/node` build tests cleanly. See
`2026-07-18_exact-solver-revisit-for-scale.md` for the decision and numbers. The
greedy-first-with-exact-comparison design is still unchanged.
