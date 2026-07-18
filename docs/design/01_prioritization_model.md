# 01 Prioritization Model

This is the spec for the pure prioritization engine (`src/engine/`). It defines
the entities, the problem the engine solves, the greedy heuristic used first, and
the units that must be unit-tested. It is deliberately faithful to the standard
minimum-set formulation used in Systematic Conservation Planning, simplified in
the data.

## Entities

- **Planning unit** `i`: a cell in the grid. Has a **cost** `c_i > 0` and a
  status of `available`, `locked-in` (must be selected), or `locked-out` (must
  not be selected).
- **Conservation feature** `f`: something we set a goal for (for example, a
  species' habitat). Has a per-unit **amount** `a_if >= 0` (how much of feature
  `f` is in unit `i`) and a **target** `t_f > 0` (how much of `f` the solution
  must represent).
- **Solution**: a set of selected units, represented as a decision variable
  `x_i in {0, 1}` per unit.

Amounts and targets share units per feature (for example, number of occupied
cells, or hectares of habitat). Targets may be authored as an absolute amount or
as a fraction of the total available amount of `f`.

## The minimum-set problem (the objective)

Minimize the total cost of the selected units, subject to meeting every feature
target:

```
minimize    sum over i of c_i * x_i
subject to  sum over i of a_if * x_i  >=  t_f   for every feature f
            x_i = 1  for every locked-in unit
            x_i = 0  for every locked-out unit
            x_i in {0, 1}
```

This is the classic minimum-set reserve-selection problem (the Marxan / prioritizr
default). It answers: "what is the cheapest set of places that meets all of my
targets?"

## Feasibility

A problem is **feasible** only if, for every feature `f`, the total available
amount can meet the target:

```
(sum of a_if over locked-in units) + (sum of a_if over available units)  >=  t_f
```

Locked-out units are excluded from the available pool. If any feature fails this
check, the engine reports the problem as infeasible and names the shortfall
features rather than returning a partial solution.

## The greedy heuristic (first solver)

The MVP solver is a greedy marginal-gain heuristic. It is fast, fully
client-side, deterministic, and teaches complementarity well (it will not simply
grab the richest cells). It is not guaranteed optimal; the exact ILP solver added
later (see the solver ADR) is the optimal comparison.

Algorithm:

1. Start with all locked-in units selected. Apply their amounts to the running
   representation total per feature.
2. Compute the remaining shortfall per feature: `s_f = max(0, t_f - represented_f)`.
3. While any `s_f > 0`:
   - For each candidate unit `i` (available, not yet selected), compute its
     **marginal contribution** toward unmet targets:
     `g_i = sum over f of min(s_f, a_if)`.
   - Skip units with `g_i = 0` (they do not reduce any shortfall).
   - Score each candidate by benefit per cost: `score_i = g_i / c_i`.
   - Select the unit with the highest score. Break ties by lower cost, then by
     lower index (so the result is deterministic).
   - Add it to the solution and update `represented_f` and `s_f`.
   - If no candidate has `g_i > 0` while shortfalls remain, stop and report
     infeasible (this should not happen if the feasibility check passed).
4. Return the selected set, its total cost, and per-feature attainment.

## Outputs

For a solved problem the engine returns:

- The selected unit set (the priority map).
- Total cost of the selection.
- Per-feature attainment: represented amount, target, and whether it is met.
- Feasibility status (and shortfall features if infeasible).

## Later objectives and knobs (Track 3, method deep-dive)

Not in the MVP; recorded here so the engine's shape anticipates them.

- **Maximum coverage under a budget**: maximize represented feature amount (or
  count of targets met) subject to `sum c_i * x_i <= B`. The greedy variant adds
  the best benefit-per-cost unit until the budget is spent.
- **Boundary / compactness penalty**: add `penalty * boundary_length(selection)`
  to the objective so solutions are less fragmented (the Marxan BLM idea). For the
  greedy solver this becomes a term in the per-unit score.
- **Feature weights**: weight features so some count more toward the objective or
  are prioritized when trading off.
- **Exact ILP solver**: glpk.js / WebAssembly, for the true optimum on small
  instances, presented alongside greedy for a greedy-versus-optimal comparison.

## Irreplaceability (backlog)

A measure of how essential a unit is to meeting targets (how often it appears in
good solutions, or how much cost rises if it is removed from the pool). Well
defined for exact/randomized methods; for a deterministic greedy it needs a
chosen definition. Deferred to the backlog.

## Simplifications (by design)

- Synthetic landscape and feature amounts; no real spatial or occurrence data at
  first.
- Cost is a single per-unit number (no multi-cost or cost layers).
- No connectivity in the MVP beyond the later boundary penalty.
- Greedy solver in the MVP; optimality comes with the later ILP solver.

## Testable units

Each of these must have a hand-checked Vitest case:

- Feasibility check: passes when totals meet targets; fails and names shortfall
  features when they do not.
- Target attainment: represented amount and met/unmet per feature for a given
  selection.
- Cost sum for a given selection.
- Greedy selection order on a small hand-built landscape where the expected
  picks and their order are known (including a case where the greedy pick differs
  from "grab the richest cell").
- Locked-in units are always in the solution and count toward representation;
  locked-out units are never selected and are excluded from availability.
- Tie-breaking is deterministic (lower cost, then lower index).
- Infeasible input is reported as infeasible, not returned as a partial solution.
