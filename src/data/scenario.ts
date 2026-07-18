// The starter teaching landscape. All values are synthetic and tuned for
// teaching, not sourced from real data. See docs/design/02_example_scenario.md.
//
// The landscape is generated deterministically from cell coordinates: three
// features clustered (with some overlap) in different regions, and a cost surface
// that rises toward a "developed" bottom-right corner. The mismatch between where
// features are and where cost is cheap is what makes prioritization interesting.

import { GRID_SIZE } from '../engine/constants.ts';
import type {
  Feature,
  PlanningUnit,
  PlanningUnitStatus,
  Problem,
} from '../engine/types.ts';

export interface ScenarioFeature {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface ScenarioUnit {
  readonly id: number;
  readonly row: number;
  readonly col: number;
  readonly cost: number;
  readonly amounts: Readonly<Record<string, number>>;
}

export interface Scenario {
  readonly gridSize: number;
  readonly features: readonly ScenarioFeature[];
  readonly units: readonly ScenarioUnit[];
}

interface FeatureBump {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly cr: number; // centre row
  readonly cc: number; // centre col
  readonly sigma: number;
  readonly peak: number;
}

const FEATURE_BUMPS: readonly FeatureBump[] = [
  {
    id: 'forest',
    name: 'Forest species',
    color: '#2e7d32',
    cr: 2,
    cc: 3,
    sigma: 2.3,
    peak: 10,
  },
  {
    id: 'wetland',
    name: 'Wetland species',
    color: '#1565c0',
    cr: 6,
    cc: 7,
    sigma: 2.3,
    peak: 10,
  },
  {
    id: 'grassland',
    name: 'Grassland species',
    color: '#f9a825',
    cr: 7,
    cc: 2,
    sigma: 2.6,
    peak: 9,
  },
];

// Amounts below this are treated as zero, giving crisp regions with genuine gaps.
const AMOUNT_FLOOR = 0.6;

function gaussian(
  row: number,
  col: number,
  cr: number,
  cc: number,
  sigma: number,
): number {
  const d2 = (row - cr) ** 2 + (col - cc) ** 2;
  return Math.exp(-d2 / (2 * sigma * sigma));
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function buildScenario(): Scenario {
  const n = GRID_SIZE;
  const units: ScenarioUnit[] = [];

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const id = row * n + col;

      const amounts: Record<string, number> = {};
      for (const b of FEATURE_BUMPS) {
        const value = round1(b.peak * gaussian(row, col, b.cr, b.cc, b.sigma));
        if (value >= AMOUNT_FLOOR) amounts[b.id] = value;
      }

      // Cost: cheap top-left, rising toward the bottom-right, with an extra
      // premium on the developed corner.
      const gradient = 1 + 8 * ((row + col) / (2 * (n - 1)));
      const corner = 4 * gaussian(row, col, n - 1, n - 1, 2);
      const cost = Math.max(1, Math.round(gradient + corner));

      units.push({ id, row, col, cost, amounts });
    }
  }

  const features = FEATURE_BUMPS.map((b) => ({
    id: b.id,
    name: b.name,
    color: b.color,
  }));
  return { gridSize: n, features, units };
}

export const SCENARIO: Scenario = buildScenario();

// Total amount of a feature across the whole landscape.
export function featureTotal(featureId: string): number {
  let total = 0;
  for (const unit of SCENARIO.units) total += unit.amounts[featureId] ?? 0;
  return total;
}

// Largest single-unit amount of a feature (used to scale the map shading).
export function featureMax(featureId: string): number {
  let max = 0;
  for (const unit of SCENARIO.units) max = Math.max(max, unit.amounts[featureId] ?? 0);
  return max;
}

export const COST_RANGE: { readonly min: number; readonly max: number } = (() => {
  let min = Infinity;
  let max = -Infinity;
  for (const unit of SCENARIO.units) {
    min = Math.min(min, unit.cost);
    max = Math.max(max, unit.cost);
  }
  return { min, max };
})();

// Build a solvable Problem from the base landscape and a target fraction per
// feature (all units available).
export function toProblem(targetFractions: Readonly<Record<string, number>>): Problem {
  return toProblemFromUnits(makeWorkingUnits(), targetFractions);
}

// An editable copy of a planning unit. The UI keeps an array of these in state
// so costs, feature amounts, and lock status can be painted on the map.
export interface WorkingUnit {
  id: number;
  row: number;
  col: number;
  cost: number;
  amounts: Record<string, number>;
  status: PlanningUnitStatus;
}

type HasAmounts = { readonly amounts: Readonly<Record<string, number>> };

// Total amount of a feature across a given set of units (the target denominator).
export function featureTotalOf(
  units: readonly HasAmounts[],
  featureId: string,
): number {
  let total = 0;
  for (const unit of units) total += unit.amounts[featureId] ?? 0;
  return total;
}

// Largest single-unit amount of a feature across a given set of units.
export function featureMaxOf(units: readonly HasAmounts[], featureId: string): number {
  let max = 0;
  for (const unit of units) max = Math.max(max, unit.amounts[featureId] ?? 0);
  return max;
}

export function costRangeOf(units: readonly { readonly cost: number }[]): {
  min: number;
  max: number;
} {
  let min = Infinity;
  let max = -Infinity;
  for (const unit of units) {
    min = Math.min(min, unit.cost);
    max = Math.max(max, unit.cost);
  }
  return { min, max };
}

// A fresh editable copy of the starter landscape (all units available).
export function makeWorkingUnits(): WorkingUnit[] {
  return SCENARIO.units.map((u) => ({
    id: u.id,
    row: u.row,
    col: u.col,
    cost: u.cost,
    amounts: { ...u.amounts },
    status: 'available',
  }));
}

// Build a Problem from an editable landscape. Targets are a fraction of each
// feature's total amount in the current (possibly edited) landscape.
export function toProblemFromUnits(
  units: readonly WorkingUnit[],
  targetFractions: Readonly<Record<string, number>>,
): Problem {
  const problemUnits: PlanningUnit[] = units.map((u): PlanningUnit => ({
    id: u.id,
    cost: u.cost,
    status: u.status,
    amounts: u.amounts,
  }));
  const features: Feature[] = SCENARIO.features.map((f): Feature => ({
    id: f.id,
    name: f.name,
    target: featureTotalOf(units, f.id) * (targetFractions[f.id] ?? 0),
  }));
  return { units: problemUnits, features };
}
