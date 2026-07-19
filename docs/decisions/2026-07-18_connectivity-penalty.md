# Connectivity: a generalized connectivity-strength penalty

## Status

Accepted

## Context

The app already has a compactness knob: a Marxan-style boundary-length penalty in
the greedy objective (`boundaryDelta = 4 - 2 * adjacentSelected`, scored as
`cost + boundaryPenalty * boundaryDelta`, using 4-connectivity `NEIGHBORS`). It is
greedy-only; the exact solver ignores it and solves pure minimum-set.

That penalty is really perimeter minimization: it rewards immediate adjacency and
so favours clumped reserves. It is a crude proxy for connectivity and cannot
express connectivity that is not immediate adjacency, for example "keep nearby
patches linked across a short gap" or "prefer connecting habitat of the same
type." Teaching connectivity as a distinct SCP idea (not just compactness) needs a
mechanism beyond the boundary penalty. See prioritizr, which separates
`add_boundary_penalties` (compactness) from `add_connectivity_penalties` (a
general connectivity matrix).

Options considered:

1. **Keep only the boundary/compactness penalty.** Simplest, but conflates
   connectivity with perimeter and cannot teach it as its own concept.
2. **Generalized connectivity-strength penalty driven by a symmetric matrix
   `c_ij`** (prioritizr `add_connectivity_penalties` style): reward selecting
   connected pairs of units together. The boundary penalty is the special case
   `c_ij` = shared edge. `c_ij` can encode distance decay (structural
   connectivity) or attribute similarity such as shared land cover (functional
   connectivity).
3. **Least-cost paths / circuit theory (Circuitscape-style functional
   connectivity).** Most faithful to connectivity science, but needs a resistance
   surface and path/flow computation; too heavy for a client-side teaching app on
   synthetic data.
4. **Connectivity to fixed anchors only** (existing protected areas / locked-in
   units). Useful but narrow; it is a subset of option 2 (anchors as high-`c_ij`
   partners).

## Decision

Adopt **option 2: a generalized connectivity penalty driven by a symmetric
connectivity matrix `c_ij`**, added to the greedy objective the same way the
boundary term is (a per-unit reward proportional to the connectivity strength to
the already-selected set). The existing compactness/boundary penalty is kept and
framed as the adjacency special case, so the two sit on one continuum and the
compactness knob remains the simple entry point.

For the teaching landscape, `c_ij` is synthetic and defaults to **distance decay**
over a bounded neighbourhood (a few cells' radius), with an optional **same-cover
boost** so the app can also demonstrate functional connectivity ("link wetland to
wetland") on top of the land-cover model. The concrete decay scale, radius, and
same-cover weighting are illustrative and belong in the implementation / a design
note, not this ADR.

Connectivity stays **greedy-only for now**, exactly like the boundary penalty: the
exact solver continues to compute pure minimum-set and ignores connectivity. Pairwise
connectivity terms in the MILP would need auxiliary pair variables and would grow
the exact instance; that is deferred. Least-cost / circuit connectivity (option 3)
is out of scope and can get its own ADR if ever needed.

## Consequences

Positive:

- Teaches connectivity as a distinct concept, not just compactness, and shows the
  structural-vs-functional distinction using data the app already has (land cover).
- Generalizes the existing boundary penalty rather than replacing it; the
  compactness knob is the `c_ij` = adjacency special case, which keeps the mental
  model coherent.
- Reuses the existing pairwise-penalty machinery in greedy (mirror `boundaryDelta`
  with a connectivity delta), and the existing `NEIGHBORS` adjacency, extended to a
  bounded neighbourhood.
- Pure and testable; the connectivity matrix is a deterministic function of the
  landscape.

Negative / trade-offs:

- Pairwise scoring is O(neighbourhood size) per candidate unit; the neighbourhood
  must stay bounded (small radius) so it remains fast at 30x30 and beyond.
- The exact solver will not reflect connectivity, so the greedy-vs-exact panel
  compares only on minimum-set. This must be stated in the UI copy, consistent with
  how the boundary penalty is already handled.
- Another Method-tab knob (connectivity strength, plus a basis choice) adds UI
  surface; it belongs next to compactness with copy that explains the relationship.
- The synthetic `c_ij` is illustrative, like all data in the app, not a real
  connectivity model.

Implementation is tracked in issue #24.
