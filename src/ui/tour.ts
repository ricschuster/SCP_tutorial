// The guided tour is data: a list of steps, each pointing at a UI region to
// highlight, and optionally a cell to open in the mechanics inspector. It is
// deliberately lightweight (narrate + highlight + optionally inspect). Adding a
// field here and handling it where the tour is driven keeps this extensible
// without changing the shape.

import { SCENARIO } from '../data/scenario.ts';

export type TourRegion =
  'intro' | 'features' | 'targets' | 'priority' | 'curve' | 'edit';

export interface TourStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  // Which UI region to highlight and scroll to for this step.
  readonly region: TourRegion;
  // Optional: a cell to open in the mechanics inspector, so a step can show the
  // cover -> habitat -> cost arithmetic on a concrete cell.
  readonly inspect?: number;
}

// Representative cells for the "how the landscape works" act, chosen from the
// generated landscape so the tour stays correct if the scenario is retuned.
const forestCells = SCENARIO.units.filter((u) => u.cover === 'forest');
const byQuality = [...forestCells].sort((a, b) => a.quality - b.quality);
const forestHi = byQuality[byQuality.length - 1]?.id;
const forestLo = byQuality[0]?.id;
const developedCell = SCENARIO.units.find((u) => u.cover === 'developed')?.id;

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    title: 'What is conservation planning?',
    body: 'Systematic conservation planning decides where to protect nature so that goals for many species are met as cheaply as possible. This tour walks the process on a small synthetic landscape.',
    region: 'intro',
  },
  {
    id: 'landcover',
    title: 'The landscape is land cover',
    body: 'You paint one of six land-cover classes on the map: forest, wetland, grassland, cropland, developed, and water. Everything else is derived from what covers each cell.',
    region: 'edit',
  },
  {
    id: 'habitat',
    title: 'Habitat comes from cover',
    body: 'Habitat for each species is computed from cover: suitability x habitat quality x 10. The inspector shows the arithmetic for this forest cell, where the forest species scores high.',
    region: 'features',
    ...(forestHi !== undefined ? { inspect: forestHi } : {}),
  },
  {
    id: 'quality',
    title: 'Forest is not forest everywhere',
    body: 'A habitat-quality factor varies smoothly across the map, so two cells of the same cover differ. This forest cell has lower quality than the last, so the same species scores less here.',
    region: 'features',
    ...(forestLo !== undefined ? { inspect: forestLo } : {}),
  },
  {
    id: 'cost',
    title: 'Cost comes from land use',
    body: 'Cost is the opportunity cost of protecting a cell. Developed and farmed land cost more than wildland, and developed land is habitat for nothing, as this cell shows.',
    region: 'features',
    ...(developedCell !== undefined ? { inspect: developedCell } : {}),
  },
  {
    id: 'targets',
    title: 'Set representation targets',
    body: 'A target says how much of each species the plan must represent, as a share of its habitat on the landscape. Raise or lower a target to change how ambitious the plan is.',
    region: 'targets',
  },
  {
    id: 'prioritize',
    title: 'Prioritize',
    body: 'The solver picks the lowest-cost set of areas that meets every target. The green cells are the priorities. It favours areas that are cheap and cover more than one species, rather than just the richest cells (this is complementarity).',
    region: 'priority',
  },
  {
    id: 'tradeoff',
    title: 'Weigh the tradeoff',
    body: 'Protecting more costs more. The curve shows total cost rising as a species target increases, so you can see how much ambition is affordable.',
    region: 'curve',
  },
  {
    id: 'constraints',
    title: 'Add real-world constraints',
    body: 'Plans meet reality: lock in areas that are already protected, lock out no-go areas, or repaint land cover on the map. Everything re-solves live so you can see the effect.',
    region: 'edit',
  },
  {
    id: 'explore',
    title: 'Now explore',
    body: 'That is the whole loop: land cover becomes habitat and cost, you set targets, the solver prioritizes, and you evaluate and adjust. Change anything and watch the plan respond.',
    region: 'intro',
  },
];
