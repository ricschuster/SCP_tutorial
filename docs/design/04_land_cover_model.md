# 04 Land-cover landscape model

The landscape model for the v2 landscape. It replaces the raw per-feature amount
painting of the MVP with a land-cover-driven model: the learner paints land-cover
classes, and each cell's feature amounts and cost are derived from its cover. All
values are illustrative and tuned for teaching, not sourced from real data.

See the ADR `docs/decisions/2026-07-18_land-cover-landscape-model.md` for the
decision and alternatives. This note pins the concrete model the implementation
should follow. Numbers here are proposed starting values and may be tuned during
build.

## Why cover-driven

Painting abstract per-feature amounts and a separate cost layer is hard to grasp
and does not scale past a handful of features. Driving everything from land cover:

- Makes the landscape legible ("this is forest, this is a city"), which aids
  intuition.
- Derives feature amounts and cost together from one edit: developing a
  habitat-rich area drops its habitat and raises its cost in a single stroke.
- Scales to many features from a few paintable classes (few categorical colors to
  paint, arbitrarily many derived feature layers viewed as scalar surfaces).
- Mirrors the sibling SHI_example mental model (land cover -> species habitat).

The prioritization engine is unchanged. `solve()` still takes units with
`amounts` and `cost`; the cover -> amounts + cost derivation is a pure function in
`src/data`, so the engine, greedy, exact, and attainment code are untouched.

## Grid

- 30x30 = 900 planning units (up from 10x10). Matches SHI_example and reads as a
  real landscape. Map panels move from SVG to canvas for this size (see the
  scale/rendering issue).
- One dominant land-cover class per cell (a single class, not a fractional
  composition), like SHI_example's character grid. Painting sets a cell's class.

## Land-cover classes

Six classes, a categorical palette (stable colors, solves the many-features color
problem because feature identity is no longer carried by map color):

| class     | reads as                        | proposed color |
| --------- | ------------------------------- | -------------- |
| forest    | closed-canopy forest            | dark green     |
| wetland   | marsh / bog                     | teal-blue      |
| grassland | native grassland / meadow       | gold           |
| cropland  | farmed land                     | khaki          |
| developed | built-up / urban                | grey           |
| water     | open water                      | light blue     |

## Conservation features (3 species to start)

Feature identity stays as three species; they are now **derived** from cover via a
suitability profile, so adding a fourth or tenth species is just another row of
data and no new UI color. This is the scaling answer, demonstrable rather than
hypothetical.

### Suitability matrix (species x cover), values 0..1

|                | forest | wetland | grassland | cropland | developed | water |
| -------------- | ------ | ------- | --------- | -------- | --------- | ----- |
| Forest species | 1.00   | 0.20    | 0.10      | 0.15     | 0.00      | 0.00  |
| Wetland species| 0.15   | 1.00    | 0.10      | 0.05     | 0.00      | 0.30  |
| Grassland sp.  | 0.10   | 0.20    | 1.00      | 0.40     | 0.00      | 0.00  |

Notes: grassland species half-uses cropland (0.40); wetland species uses open
water edge (0.30); developed land is habitat for none of them.

## Habitat quality (within-class variation)

Forest is not equally good forest everywhere: a core is better than an edge or a
road-adjacent stand. So a cell carries a **habitat quality** factor, a seeded
smooth spatial field `quality(cell)` in `[Q_MIN, 1]` (proposed `Q_MIN = 0.4`),
generated deterministically (fixed-phase value noise, no runtime randomness). This
is a genuine concept the tour and inspector teach, not just anti-blockiness noise.

### Amount derivation

```
amount(species, cell) = suitability[species][cover(cell)]
                      * quality(cell)
                      * SPECIES_PEAK          (proposed SPECIES_PEAK = 10)
```

Amounts below `AMOUNT_FLOOR` (proposed 0.6) are treated as zero, giving crisp
regions with genuine gaps (as in the MVP).

## Cost (cover-only)

Cost is the opportunity cost of protecting that land use. There is no separate
cost brush; the learner changes cost by changing cover.

### Base cost per cover (proposed)

| class     | base cost |
| --------- | --------- |
| water     | 1         |
| forest    | 3         |
| wetland   | 3         |
| grassland | 4         |
| cropland  | 8         |
| developed | 14        |

### Cost derivation

```
cost(cell) = round( baseCost[cover(cell)] * (1 + costVar(cell)) ),  min 1
```

`costVar(cell)` is a **separate** small seeded field (proposed +/-15%), read as
land value / access variation. It is deliberately distinct from `quality` so the
app never implies "better habitat costs more." Two independent fields.

## Targets and locks

- Targets are unchanged in concept: per species, a fraction of that species' total
  habitat (sum of derived amounts) in the current (possibly edited) landscape.
- Lock in / lock out are unchanged. Lock-in color moves off green to avoid
  colliding with the selected-priority green; the priority map gains a legend.

## Showing the mechanics

The learner must be able to see how amounts and cost are computed.

- **Cell inspector (Explore view):** click any cell for its arithmetic:

  ```
  Cell — Forest (quality 0.82)
    Forest species:    suit 1.00 x quality 0.82 x 10 = 8.2
    Wetland species:   suit 0.15 x quality 0.82 x 10 = 1.2
    Grassland species: suit 0.10 x quality 0.82 x 10 = 0.8
    Cost: base(Forest) 3, local +1 = 4
  ```

- **Rule tables (Method / advanced view):** the suitability matrix and the
  cost-by-cover table, read-only to start. Making the matrix editable ("bump a
  species' cropland suitability, watch habitat and priorities move") is a good
  future lever, deferred.

## Share / URL state

The shareable state stores the **cover-class grid** (as a diff from the base cover
layout) plus per-species targets, method options, and lock status. The `quality`
and `costVar` fields and all derived amounts and costs are deterministic from the
cover grid and fixed seeds, so they are not stored. This keeps the token compact
and a default scenario yields a clean URL, as today.

## Guided tour

The tour gains a first act, "how this landscape works," before the existing "how
prioritization works" act:

1. This is land cover (name the six classes).
2. Habitat comes from cover (cover map beside one species' derived habitat
   surface; read one cell's number).
3. Forest is not forest everywhere (the quality gradient within a class).
4. Cost comes from land use (developed and farmed land cost more to protect).

...then the existing steps (targets, solve, complementarity, cost-vs-target). To
support steps 2-3 a tour step may set the active feature layer and point the cell
inspector at a specific cell (a small extension to the data-driven step model).

## What this supersedes

Replaces the raw-amount landscape of `02_example_scenario.md` (10x10, painted
per-feature amounts, separate cost brush). That note stays as the MVP record; this
note governs the v2 landscape.
