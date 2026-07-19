# Design note: connectivity penalty

Status: accepted. Implements GitHub issue #24, following the connectivity ADR
(`docs/decisions/2026-07-18_connectivity-penalty.md`). The ADR chose a generalized
connectivity-strength penalty driven by a symmetric matrix `c_ij` and left the
concrete decay scale, radius, and same-cover weighting to the implementation.
This note records those choices and the wiring.

## Engine

`SolveOptions` gains `connectivityPenalty` and a `connectivity` matrix
(`ConnectivityMatrix = Map<unitId, {to, strength}[]>`). Greedy scoring mirrors the
boundary term: a candidate's scoring cost is

```
cost
  + boundaryPenalty   * boundaryDelta          (rewards immediate adjacency)
  - connectivityPenalty * sum(c_ij over chosen) (rewards links to the reserve)
```

floored at a small positive value. Connectivity lowers a well-connected
candidate's effective cost, so greedy pulls the solution toward connected
configurations. It applies to both min-set and max-coverage (shared scoring).
Connectivity is greedy-only; the exact solver still computes pure minimum-set and
ignores it, exactly as it does the boundary penalty.

## The matrix (`src/data/connectivity.ts`)

`c_ij` is synthetic and illustrative. It is symmetric and bounded to a small
neighbourhood so a candidate's connectivity sum is cheap:

- Radius `CONNECTIVITY_RADIUS = 3` cells, circular (Euclidean distance <= 3).
- Structural connectivity: distance decay `strength = exp(-distance / 1)`, so an
  orthogonal neighbour contributes ~0.37 and it falls off quickly. This keeps a
  fully surrounded cell's total roughly in the range of the compactness penalty,
  so the two knobs share the 0..5 scale.
- Functional connectivity (optional): a same-cover boost multiplies a link by
  `1 + SAME_COVER_BOOST` (= 2x) when both cells share land cover, so the app can
  demonstrate "link like habitat to like habitat" on top of the land-cover model.

The same-cover boost reads each cell's (possibly edited) cover, so the matrix is
rebuilt when covers change; the structural part is pure geometry. The matrix is
only built when the penalty is on.

`connectivityPotential(matrix)` (per-unit total link strength) is provided for a
possible connectivity-surface map layer; it is not yet shown (see follow-ups).

## UI

A "Connectivity" slider (0..5, step 0.5) sits next to "Compactness" in the Method
tab, with a "Link same cover (functional connectivity)" checkbox that appears once
connectivity is on, and copy framing compactness as the immediate-adjacency
special case. When either penalty is on, the greedy-vs-exact panel notes that the
exact optimum ignores them. Connectivity and the same-cover flag are part of the
shared scenario state, so they persist in the share URL (additive optional codec
fields `cn` / `sc`, no schema-version bump; older links decode to 0 / off).

## Limits / follow-ups

- Illustrative synthetic `c_ij`, not a real connectivity model. Least-cost /
  circuit connectivity is out of scope (its own ADR if ever needed).
- Greedy-only; pairwise terms in the MILP are deferred (ADR).
- A connectivity-surface map layer (using `connectivityPotential`) is a natural
  next visual, deferred to keep this change focused.
