// Core types for the prioritization engine. See
// docs/design/01_prioritization_model.md.

export type PlanningUnitStatus = 'available' | 'locked-in' | 'locked-out';

export interface PlanningUnit {
  // Stable identifier (for a grid, the cell index).
  readonly id: number;
  // Cost of protecting this unit (c_i > 0).
  readonly cost: number;
  readonly status: PlanningUnitStatus;
  // Amount of each feature present in this unit, keyed by feature id (a_if >= 0).
  // A missing feature id means zero.
  readonly amounts: Readonly<Record<string, number>>;
}

export interface Feature {
  readonly id: string;
  readonly name: string;
  // Amount of this feature the solution must represent (t_f > 0), as an absolute
  // amount. Use targetFromFraction() to derive it from a proportion.
  readonly target: number;
}

export interface Problem {
  readonly units: readonly PlanningUnit[];
  readonly features: readonly Feature[];
}

export interface FeatureAttainment {
  readonly featureId: string;
  readonly represented: number;
  readonly target: number;
  readonly met: boolean;
}

export interface FeasibilityResult {
  readonly feasible: boolean;
  // Feature ids whose target cannot be met by the selectable units.
  readonly shortfallFeatures: readonly string[];
}

export interface Solution {
  readonly feasible: boolean;
  // Selected unit ids, in the order the solver added them.
  readonly selected: readonly number[];
  readonly totalCost: number;
  readonly attainment: readonly FeatureAttainment[];
  // Empty when feasible; otherwise the features that cannot be met.
  readonly shortfallFeatures: readonly string[];
}
