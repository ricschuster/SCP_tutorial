# 02 Example Scenario

The concrete starter example that anchors the MVP. All values are illustrative
and tuned for teaching, not sourced from real data.

## The landscape

- A small grid of planning units (start ~10x10 = 100 units).
- Each unit has a synthetic **cost**. The cost surface is varied on purpose (for
  example, cheaper in one region, expensive near a notional "developed" corner)
  so that the cheapest-to-protect places are not the same as the richest-in-
  features places. That mismatch is what makes prioritization interesting.

## The features

Three conservation features, each concentrated in a different part of the
landscape so that no single unit satisfies everything:

- **Feature A** (a forest species): habitat clustered in one region.
- **Feature B** (a wetland species): habitat clustered in another, partly
  overlapping region.
- **Feature C** (a grassland species): habitat spread across a third region.

Each unit holds a per-unit amount `a_if >= 0` for each feature. Some units hold
more than one feature (overlap), which is what lets the solver be efficient by
picking multi-feature units.

## The default problem

- Target: represent 30% of each feature's total available amount.
- All units available (none locked in or out) to start.
- Cost is the synthetic per-unit cost.

Pressing **Solve** returns the cheapest set of units that reaches 30% for all
three features.

## What the learner does and sees

1. **Solve the default.** See the priority map, the total cost, and three
   attainment bars all at (or just above) target.
2. **Raise a target.** Push Feature B to 60% and re-solve. More units are needed;
   cost rises; the priority map grows, especially in Feature B's region.
3. **See complementarity.** Notice the solver prefers units that carry two
   features over a slightly richer single-feature unit. It is filling gaps, not
   ranking cells.
4. **Change costs.** Make one region expensive and re-solve; priorities shift to
   cheaper units that still meet the targets.
5. **Lock in and lock out.** Lock in a notional existing protected area (it is
   always kept and counts toward targets) and lock out a no-go region (never
   selected). Re-solve and see how the rest of the plan adapts.

## Teaching beats this scenario supports

- Complementarity: the whole is chosen together, not cell by cell.
- Cost-efficiency: meeting targets for the least cost, not maximizing richness.
- The cost-versus-target tradeoff: higher targets cost more; the curve is
  visible by dragging a target.
- Constraints: locked-in and locked-out units reshape the efficient solution.

## Notes for later layers

- Track 2 (full process) uses this same landscape but frames each action as a
  stage of a planning exercise, with short explanatory text.
- Track 3 (method deep-dive) reuses it to contrast objectives (minimum-set versus
  maximum-coverage under a budget), show the boundary penalty producing more
  compact solutions, and compare greedy against the exact solver.
