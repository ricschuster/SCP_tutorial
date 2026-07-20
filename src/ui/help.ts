// Just-in-time help copy for the controls and SCP terms, kept in one place so it
// is easy to review and stays consistent in voice with the guided tour. Each
// entry is one short, self-contained explanation (no external references). Wired
// into the UI through the Tooltip component. No em dashes (project rule).

export interface HelpEntry {
  // Short human label, used for the info affordance's accessible name.
  readonly label: string;
  readonly text: string;
}

export const HELP = {
  targets: {
    label: 'targets',
    text: 'How much of each species you want represented, as a percentage of the total habitat present in the whole landscape. A 30% target means the chosen areas must hold at least 30% of that species habitat.',
  },
  cost: {
    label: 'cost',
    text: 'What it takes to protect an area, derived from its land cover (not set directly). Meeting a higher target usually means buying more or pricier areas, so the cheapest plan costs more. That is the cost-versus-target tradeoff.',
  },
  objective: {
    label: 'the objective',
    text: 'Minimum set: the cheapest plan that meets every target. Max coverage: given a fixed budget, the plan that represents as much as possible. One minimizes cost for a fixed goal; the other maximizes the goal for a fixed cost.',
  },
  budget: {
    label: 'the budget',
    text: 'The spending cap for max coverage, as a share of the whole landscape cost. The solver buys the areas that add the most representation until the budget runs out.',
  },
  weights: {
    label: 'feature weights',
    text: 'How much each species counts relative to the others. Raising a weight makes the solver work harder to represent that species; the default of 1 treats every species equally.',
  },
  compactness: {
    label: 'compactness',
    text: 'A penalty on the outer edge of the selected set, which pushes the plan toward fewer, blockier clusters instead of scattered single cells. It steers the greedy heuristic only.',
  },
  connectivity: {
    label: 'connectivity',
    text: 'A reward for plans whose areas are linked across short gaps, not only immediately touching (compactness is the special case of touching). Turn on "link same cover" to reward connecting like habitat to like habitat. It steers the greedy heuristic only.',
  },
  locks: {
    label: 'locking areas',
    text: 'Lock in forces an area into every plan (for example, an existing protected area); lock out keeps it out entirely (a no-go area). The solver works around your locks. Click a locked cell again with the same tool to clear it.',
  },
  irreplaceability: {
    label: 'irreplaceability',
    text: 'How often each area appears across many near-optimal plans. Areas that show up in almost every plan are hard to substitute (highly irreplaceable); areas that appear rarely are interchangeable.',
  },
  spotlight: {
    label: 'the species spotlight',
    text: 'Highlights one species habitat at a time on a single shaded scale (darker means more), so you can see where that species is concentrated without colour standing in for identity.',
  },
  compare: {
    label: 'greedy versus near-optimal',
    text: 'The greedy heuristic builds a plan one best step at a time, fast but not guaranteed best. The near-optimal optimum is solved to within 1% of the true optimum, so the gap between them shows how much the shortcut costs.',
  },
  curve: {
    label: 'the cost-target curve',
    text: 'Shows how the cheapest plan that meets a species target gets more expensive as you ask for more of it. The dot marks your current target on that curve.',
  },
} as const satisfies Record<string, HelpEntry>;

export type HelpKey = keyof typeof HELP;
