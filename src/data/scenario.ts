// The teaching landscape. All values are synthetic and tuned for teaching, not
// sourced from real data. See docs/design/04_land_cover_model.md.
//
// The landscape is a grid of land-cover cells generated deterministically from
// cell coordinates (fixed-phase value noise, no runtime randomness): recognisable
// regions of forest, wetland/water, grassland, cropland, and a developed cluster.
// Each cell also carries a habitat-quality factor and a cost-variation factor
// (both smooth spatial fields). A cell's per-species feature amounts and its cost
// are DERIVED from its cover via land-cover.ts; the engine still consumes plain
// amounts and cost, so it is unchanged.

import { GRID_SIZE } from '../engine/constants.ts';
import type {
  Feature,
  PlanningUnit,
  PlanningUnitStatus,
  Problem,
} from '../engine/types.ts';
import { amountsForCover, costForCover, type CoverId, Q_MIN } from './land-cover.ts';

export interface ScenarioFeature {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface ScenarioUnit {
  readonly id: number;
  readonly row: number;
  readonly col: number;
  readonly cover: CoverId;
  // Fixed spatial fields (function of position, not cover), used by the
  // derivation and, later, the cell inspector.
  readonly quality: number;
  readonly costVar: number;
  // Derived from the fields above.
  readonly cost: number;
  readonly amounts: Readonly<Record<string, number>>;
}

export interface Scenario {
  readonly gridSize: number;
  readonly features: readonly ScenarioFeature[];
  readonly units: readonly ScenarioUnit[];
}

// The species. Ids match the suitability-matrix rows in land-cover.ts. Colours
// are used only for feature identity in the target/weight controls and the
// feature table; the maps shade habitat on a single scalar ramp, not per-species
// hues, so the display scales to many features (see docs/design/08).
const FEATURES: readonly ScenarioFeature[] = [
  { id: 'forest', name: 'Forest species', color: '#2e7d32' },
  { id: 'wetland', name: 'Wetland species', color: '#1565c0' },
  { id: 'grassland', name: 'Grassland species', color: '#f9a825' },
  { id: 'riparian', name: 'Riparian species', color: '#00acc1' },
  { id: 'farmland', name: 'Farmland species', color: '#6d4c41' },
  { id: 'waterbird', name: 'Waterbird species', color: '#5e35b1' },
  { id: 'generalist', name: 'Generalist species', color: '#546e7a' },
  { id: 'shrubland', name: 'Shrubland species', color: '#c0ca33' },
];

function gaussian(row: number, col: number, cr: number, cc: number, s: number): number {
  return Math.exp(-(((row - cr) ** 2 + (col - cc) ** 2) / (2 * s * s)));
}

// A smooth, deterministic field in [0, 1] from a few fixed-phase sinusoids. No
// runtime randomness, so the landscape is stable across loads.
function smooth01(row: number, col: number, phase: number): number {
  const n =
    Math.sin(row * 0.55 + phase) +
    Math.cos(col * 0.5 + phase * 1.3) +
    0.7 * Math.sin((row + col) * 0.3 + phase * 0.7) +
    0.6 * Math.cos((row - col) * 0.42 + phase * 1.7);
  return Math.min(1, Math.max(0, (n / 3.3 + 1) / 2));
}

// Region layout: score each cover class at a cell (blobs + a little wander) and
// take the strongest. Grassland is the baseline that fills the gaps.
function coverAt(row: number, col: number, n: number): CoverId {
  const s = n / 30; // scale centres/sigmas written for a 30-grid
  const jit = (phase: number): number => (smooth01(row, col, phase) - 0.5) * 0.35;
  const scores: Record<CoverId, number> = {
    forest: 1.1 * gaussian(row, col, 7 * s, 8 * s, 6.5 * s) + jit(0.5),
    developed: 1.3 * gaussian(row, col, 22 * s, 7 * s, 3.4 * s) + jit(4.5),
    cropland: 0.95 * gaussian(row, col, 9 * s, 21 * s, 6.5 * s) + jit(3.5),
    wetland: 1.05 * gaussian(row, col, 23 * s, 22 * s, 5.5 * s) + jit(1.5),
    water: 1.5 * gaussian(row, col, 26 * s, 25 * s, 2.6 * s) + jit(2.5),
    grassland: 0.5 + jit(5.5),
  };
  let best: CoverId = 'grassland';
  let bestScore = -Infinity;
  for (const id of Object.keys(scores) as CoverId[]) {
    if (scores[id] > bestScore) {
      bestScore = scores[id];
      best = id;
    }
  }
  return best;
}

function buildScenario(): Scenario {
  const n = GRID_SIZE;
  const units: ScenarioUnit[] = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const id = row * n + col;
      const cover = coverAt(row, col, n);
      const quality = Q_MIN + (1 - Q_MIN) * smooth01(row, col, 1.7);
      const costVar = (smooth01(row, col, 4.2) - 0.5) * 0.3;
      units.push({
        id,
        row,
        col,
        cover,
        quality,
        costVar,
        cost: costForCover(cover, costVar),
        amounts: amountsForCover(cover, quality),
      });
    }
  }
  return { gridSize: n, features: FEATURES, units };
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

// An editable copy of a planning unit. The UI keeps an array of these in state.
// Cover and lock status are what the learner edits; amounts and cost are derived
// from cover (kept in sync by applyCover) so the rest of the app can read them
// directly.
export interface WorkingUnit {
  id: number;
  row: number;
  col: number;
  cover: CoverId;
  quality: number;
  costVar: number;
  amounts: Record<string, number>;
  cost: number;
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

// Combined habitat in a unit: the total amount summed across all species. Used
// by the single "combined habitat" scalar map, so the display does not need one
// coloured layer per feature.
export function combinedHabitatOf(unit: HasAmounts): number {
  let total = 0;
  for (const amount of Object.values(unit.amounts)) total += amount;
  return total;
}

// Largest combined-habitat total across a set of units (scales the combined map).
export function combinedHabitatMaxOf(units: readonly HasAmounts[]): number {
  let max = 0;
  for (const unit of units) max = Math.max(max, combinedHabitatOf(unit));
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

// Grid adjacency (4-connectivity): unit id -> neighbouring unit ids. Fixed by the
// grid topology, so it is computed once. Used by the boundary/compactness penalty.
export const NEIGHBORS: ReadonlyMap<number, readonly number[]> = (() => {
  const n = SCENARIO.gridSize;
  const map = new Map<number, readonly number[]>();
  for (const u of SCENARIO.units) {
    const nb: number[] = [];
    if (u.row > 0) nb.push((u.row - 1) * n + u.col);
    if (u.row < n - 1) nb.push((u.row + 1) * n + u.col);
    if (u.col > 0) nb.push(u.row * n + (u.col - 1));
    if (u.col < n - 1) nb.push(u.row * n + (u.col + 1));
    map.set(u.id, nb);
  }
  return map;
})();

// A fresh editable copy of the starter landscape (all units available).
export function makeWorkingUnits(): WorkingUnit[] {
  return SCENARIO.units.map((u) => ({
    id: u.id,
    row: u.row,
    col: u.col,
    cover: u.cover,
    quality: u.quality,
    costVar: u.costVar,
    amounts: { ...u.amounts },
    cost: u.cost,
    status: 'available',
  }));
}

// Repaint a unit's cover, re-deriving its amounts and cost from the new cover and
// the cell's (unchanged) quality and cost-variation fields.
export function applyCover(unit: WorkingUnit, cover: CoverId): WorkingUnit {
  return {
    ...unit,
    cover,
    amounts: amountsForCover(cover, unit.quality),
    cost: costForCover(cover, unit.costVar),
  };
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
