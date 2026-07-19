# Landscape model: land-cover driven, features derived from cover

## Status

Accepted

## Context

The MVP landscape (`docs/design/02_example_scenario.md`) has the learner paint raw
per-feature amounts and a separate cost layer on a 10x10 grid. In testing this
proved hard to grasp (the amounts are abstract), it does not give a "proper"
landscape or cost distribution, and it does not scale: distinct per-feature map
colors break down past a handful of features, and painting amounts feature by
feature is unworkable at 10 or 100 features.

The sibling project NCC-CNC/SHI_example uses a land-cover model (paint a cover
type, click cells; species habitat is derived from cover) on a ~30x30 grid, which
is more intuitive and is the author's established mental model.

Options considered:

1. **Keep raw amounts**, just improve the base distribution and cost surface.
   Least work, but stays abstract and does not scale.
2. **Cover classes as features (1:1)**: features are habitat/cover types, amount =
   area of that cover. Simple and legible, but caps features at ~6 and so does not
   answer the scaling question.
3. **Cover classes with species derived via a suitability matrix (SHI-style)**:
   paint a few cover classes; derive arbitrarily many species features from them.

## Decision

Adopt option 3: a **land-cover-driven landscape**. The learner paints one of six
land-cover classes per cell; each species feature's per-cell amount is derived
from a species-by-cover **suitability matrix** times a **habitat quality** field;
**cost is derived from cover only** (opportunity cost of the land use), with no
separate cost brush.

Key parameters (single dominant class per cell, 30x30 grid, three starting
species, quality and cost variation as separate seeded fields) and the concrete
matrix, cost table, and formulas are specified in
`docs/design/04_land_cover_model.md`.

The habitat quality field (within-class variation) is framed as a teaching
concept, not noise: forest is not equally good forest everywhere. It is surfaced
in the cell inspector and the guided tour.

## Consequences

Positive:

- Intuitive, legible landscape; one edit changes habitat and cost together.
- Scales to many features from a few paintable classes: feature identity leaves
  the map palette (categorical cover colors) and moves to scalar habitat layers
  plus a feature table. Adding a species is a data row, not a new color.
- The prioritization engine is unchanged. `solve()` still consumes units with
  `amounts` and `cost`; the cover -> amounts + cost derivation is a pure function
  in `src/data`. Greedy, exact, attainment, and feasibility code are untouched.
- Cover-only cost teaches the land-use / opportunity-cost link directly.

Negative / trade-offs:

- Adds a conceptual layer (cover -> habitat) ahead of the core SCP math. Accepted:
  it aids intuition and matches the app's teaching arc; the mechanics are shown
  explicitly (inspector + rule tables) so the derivation is never a black box.
- 30x30 = 900 units pushes map rendering from SVG toward canvas and stresses the
  exact solver (both tracked as separate work; the solver is revisited in its own
  ADR).
- The share codec changes to store a cover grid rather than amount diffs.
- Supersedes the raw-amount model in `02_example_scenario.md`, which remains as
  the MVP record.
