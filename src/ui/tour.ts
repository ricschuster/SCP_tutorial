// The guided tour is data: a list of steps, each pointing at a UI region to
// highlight. This is deliberately lightweight (narrate + highlight an existing
// panel). It is also the extension point for a richer walkthrough later: add
// optional fields to TourStep (for example a preset to apply, or a required
// action to gate advancing) and handle them where the tour is driven, without
// changing this shape.

export type TourRegion =
  'intro' | 'features' | 'targets' | 'priority' | 'curve' | 'edit';

export interface TourStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  // Which UI region to highlight and scroll to for this step.
  readonly region: TourRegion;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    title: 'What is conservation planning?',
    body: 'Systematic conservation planning decides where to protect nature so that goals for many features are met as cheaply as possible. This tour walks the process on a small synthetic landscape.',
    region: 'intro',
  },
  {
    id: 'features',
    title: 'Start with the data: features',
    body: 'Each map shows where a conservation feature lives (here, three species). Every area also has a cost to protect. Notice the features sit in different places, so no single area covers everything.',
    region: 'features',
  },
  {
    id: 'targets',
    title: 'Set representation targets',
    body: 'A target says how much of each feature the plan must represent, as a share of what is on the landscape. Raise or lower a target to change how ambitious the plan is.',
    region: 'targets',
  },
  {
    id: 'prioritize',
    title: 'Prioritize',
    body: 'The solver picks the lowest-cost set of areas that meets every target. The green cells are the priorities. It favours areas that are cheap and cover more than one feature, rather than just the richest cells (this is complementarity).',
    region: 'priority',
  },
  {
    id: 'tradeoff',
    title: 'Weigh the tradeoff',
    body: 'Protecting more costs more. The curve shows total cost rising as a feature target increases, so you can see how much ambition is affordable.',
    region: 'curve',
  },
  {
    id: 'constraints',
    title: 'Add real-world constraints',
    body: 'Plans meet reality: lock in areas that are already protected, lock out no-go areas, or edit costs and features on the map. Everything re-solves live so you can see the effect.',
    region: 'edit',
  },
  {
    id: 'explore',
    title: 'Now explore',
    body: 'That is the whole loop: features, targets, prioritize, evaluate, and adjust. Change anything and watch the plan respond.',
    region: 'intro',
  },
];
