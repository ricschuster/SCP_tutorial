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
- Adding glpk.js later brings a WebAssembly dependency and bounds the exact solver
  to small instances; both are acceptable given the synthetic, small-grid scope.
