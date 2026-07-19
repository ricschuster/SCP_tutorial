# Design note: many-feature display

Status: accepted. Completes GitHub issue #31. The 30x30 landscape (#30) and the
canvas renderer (#21/#46) already landed; this note covers the remaining piece:
a display that scales past a handful of species without one hue per feature.

## Problem

The app encoded feature identity in map colour: one coloured habitat small-multiple
per species. That is fine for three species and breaks down at ten or a hundred
(no room for that many distinct hues, and a wall of maps). The teaching model was
always "a few paintable cover classes, arbitrarily many derived species", so the
display should not be the thing that caps the feature count.

## Changes

Species count grows from 3 to 8 (`forest, wetland, grassland, riparian, farmland,
waterbird, generalist, shrubland`). Adding a species is just another row in the
`SUITABILITY` matrix and a matching `SCENARIO.features` entry; everything derives
from the matrix. Developed cover stays suitability 0 for every species, so built
land reads as "no habitat" (the inspector and tests rely on this).

Habitat maps stop being per-species colour surfaces:

- A single **combined-habitat** map shades each cell by the total habitat summed
  across all species, on one sequential ramp.
- A **"view species" selector** (a dropdown) drives one **spotlight** habitat map,
  also on the same single ramp. So there are two habitat maps regardless of how
  many species exist, not one per species.
- Feature colours are kept only for identity in the target/weight controls and the
  feature table, never on the maps.

Feature identity moves to a **feature table** (the old attainment readout, now a
real `<table>`): a swatch + name, represented / target, and a progress bar per
species. It scales to many rows and is the canonical place to read per-feature
state.

## Why summed for the combined layer

"Total habitat here" is the most intuitive scalar read of a cell and matches the
cost map's "how much" framing. Species richness (count present) and average were
considered; sum was chosen for directness. The spotlight map covers the
per-species view when a learner wants it.

## Out of scope / follow-ups

- The map ramp is a fixed single hue; a learner cannot recolour it.
- A connectivity-surface layer (`connectivityPotential` from #24) would slot in as
  another scalar map here; deferred.
- Targets and weights are still one control per feature. That is a vertical list,
  so it scales acceptably; a bulk "set all targets" control could come later if the
  feature count grows much further.
