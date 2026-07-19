// The guided tour is data: a list of steps, each pointing at a UI region to
// highlight and (optionally) a set of control actions to perform, so a step can
// actually show the concept it describes (open the inspector, spotlight a
// species, turn on the irreplaceability layer, run the exact solver, or set the
// connectivity knob). The driver in App.tsx applies each step's actions and
// restores the pre-tour state when the tour closes.
//
// The tour has two scopes: a short "read the landscape" tour (the first
// SHORT_TOUR_LENGTH steps) is the default, and a learner can continue into the
// full tour (targets, prioritize, irreplaceability, constraints, and the Method
// deep-dive).

import { SCENARIO } from '../data/scenario.ts';
import type { AppView } from '../data/share.ts';

export type TourRegion =
  | 'intro'
  | 'features'
  | 'targets'
  | 'priority'
  | 'curve'
  | 'edit'
  | 'compare'
  | 'connectivity';

export interface TourStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  // Which UI region to highlight and scroll to for this step.
  readonly region: TourRegion;
  // Which tab this step lives on.
  readonly tab: AppView;
  // Optional actions. Each step declares the full control state it wants, so
  // steps are order-independent: the driver applies exactly these and clears the
  // rest to their tour defaults (inspector closed, no irreplaceability layer,
  // spotlight on the first species, connectivity off).
  readonly inspect?: number;
  readonly spotlight?: string;
  readonly showIrrep?: boolean;
  readonly connectivityPenalty?: number;
}

// How many leading steps make up the short "read the landscape" tour.
export const SHORT_TOUR_LENGTH = 6;

// Representative cells for the inspector steps, chosen from the generated
// landscape so the tour stays correct if the scenario is retuned.
const forestCells = SCENARIO.units.filter((u) => u.cover === 'forest');
const byQuality = [...forestCells].sort((a, b) => a.quality - b.quality);
const forestHi = byQuality[byQuality.length - 1]?.id;
const forestLo = byQuality[0]?.id;
const developedCell = SCENARIO.units.find((u) => u.cover === 'developed')?.id;

export const TOUR_STEPS: readonly TourStep[] = [
  // Act 1 - Read the landscape (the short tour).
  {
    id: 'welcome',
    title: 'Plan a protected-area network',
    body: 'You are planning a protected-area network for this region. Eight species need habitat and money is limited: where do you protect? This short tour shows how the landscape works, and you can continue into the full method at the end.',
    region: 'intro',
    tab: 'explore',
  },
  {
    id: 'landcover',
    title: 'The landscape is land cover',
    body: 'You paint one of six land-cover classes: forest, wetland, grassland, cropland, developed, and water. Everything else is derived from what covers each cell.',
    region: 'edit',
    tab: 'explore',
  },
  {
    id: 'habitat',
    title: 'Cover becomes habitat',
    body: 'Habitat is computed from cover: suitability x habitat quality x 10. In this forest cell a forest species like the Woodland Caribou scores high. One rule gives every species its habitat.',
    region: 'features',
    tab: 'explore',
    ...(forestHi !== undefined ? { inspect: forestHi } : {}),
  },
  {
    id: 'quality',
    title: 'Same cover, different value',
    body: 'A habitat-quality factor varies smoothly across the map, so two cells of the same cover differ. This forest cell has lower quality, so the same species scores less here.',
    region: 'features',
    tab: 'explore',
    ...(forestLo !== undefined ? { inspect: forestLo } : {}),
  },
  {
    id: 'cost',
    title: 'Cost is opportunity cost',
    body: 'Cost is the opportunity cost of protecting a cell. Developed and farmed land cost more than wildland, and developed land is habitat for nothing, as this cell shows.',
    region: 'features',
    tab: 'explore',
    ...(developedCell !== undefined ? { inspect: developedCell } : {}),
  },
  {
    id: 'manyspecies',
    title: 'Eight species, one map',
    body: 'Eight species is too many for one colour each, so habitat shows on a single scale: a combined map plus a spotlight you switch by species (here the Common Loon, tied to water). The feature table tracks every species at once.',
    region: 'features',
    tab: 'explore',
    spotlight: 'waterbird',
  },
  // Act 2 - Build a plan.
  {
    id: 'targets',
    title: 'Set representation targets',
    body: 'A target says how much of each species the plan must represent, as a share of its habitat on the landscape. Raise or lower a target to change how ambitious the plan is.',
    region: 'targets',
    tab: 'explore',
  },
  {
    id: 'prioritize',
    title: 'Prioritize',
    body: 'The solver picks the lowest-cost set of areas that meets every target. The green cells are the priorities. It favours cheap cells that cover several species at once, rather than the single richest cells. This is complementarity.',
    region: 'priority',
    tab: 'explore',
  },
  {
    id: 'irreplaceability',
    title: 'What is irreplaceable?',
    body: 'Turn on irreplaceability: some areas appear in nearly every good plan (dark, essential), while others are interchangeable (light). It shows which choices are forced and which are flexible.',
    region: 'priority',
    tab: 'explore',
    showIrrep: true,
  },
  {
    id: 'constraints',
    title: 'Meet reality',
    body: 'Plans meet reality. Lock in areas that are already protected, lock out no-go areas, or repaint the land cover. Everything re-solves live so you can see the effect.',
    region: 'edit',
    tab: 'explore',
  },
  // Act 3 - Look under the hood (Method).
  {
    id: 'exact',
    title: 'Greedy vs the true optimum',
    body: 'The solver is a fast greedy heuristic. Click "Compute exact optimum" to run the exact solver for the same targets and see how close greedy gets and where the two plans differ.',
    region: 'compare',
    tab: 'method',
  },
  {
    id: 'tradeoff',
    title: 'How much ambition is affordable?',
    body: 'Protecting more costs more. The curve shows total cost rising as a species target increases, so you can see how much ambition is affordable.',
    region: 'curve',
    tab: 'method',
  },
  {
    id: 'connectivity',
    title: 'Shape the plan: compactness and connectivity',
    body: 'Where areas sit matters, not just which. Compactness rewards touching cells; connectivity rewards areas linked across short gaps, and "link same cover" connects like habitat. With connectivity on, watch the plan pull into linked blocks.',
    region: 'connectivity',
    tab: 'method',
    connectivityPenalty: 3,
  },
  {
    id: 'explore',
    title: 'Now explore',
    body: 'That is the whole loop: land cover becomes habitat and cost, you set targets, the solver prioritizes, and you weigh the tradeoffs. Change anything and the plan responds.',
    region: 'intro',
    tab: 'explore',
  },
];
