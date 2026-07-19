// Land-cover model: the classes a learner paints, and the pure derivation from
// a cell's cover to its per-species feature amounts and its cost. See
// docs/design/04_land_cover_model.md and the land-cover ADR.
//
// All values are illustrative and tuned for teaching, not sourced from real
// data. This module is framework-free and pure so it is unit-testable and can be
// reused by the scenario generator and the (future) mechanics panel.

export type CoverId =
  'forest' | 'wetland' | 'grassland' | 'cropland' | 'developed' | 'water';

export interface LandCover {
  readonly id: CoverId;
  readonly name: string;
  // A categorical colour (few, stable), so map colour never has to scale with
  // the number of features.
  readonly color: string;
  // Opportunity cost of protecting this land use, before within-class variation.
  readonly baseCost: number;
}

export const COVERS: readonly LandCover[] = [
  { id: 'forest', name: 'Forest', color: '#2e7d32', baseCost: 3 },
  { id: 'wetland', name: 'Wetland', color: '#00897b', baseCost: 3 },
  { id: 'grassland', name: 'Grassland', color: '#9ccc65', baseCost: 4 },
  { id: 'cropland', name: 'Cropland', color: '#d4b95e', baseCost: 8 },
  { id: 'developed', name: 'Developed', color: '#9e9e9e', baseCost: 14 },
  { id: 'water', name: 'Water', color: '#4fc3f7', baseCost: 1 },
];

export const COVER_IDS: readonly CoverId[] = COVERS.map((c) => c.id);

const BASE_COST: Record<CoverId, number> = Object.fromEntries(
  COVERS.map((c) => [c.id, c.baseCost]),
) as Record<CoverId, number>;

export function isCoverId(x: unknown): x is CoverId {
  return typeof x === 'string' && COVER_IDS.includes(x as CoverId);
}

// Peak per-species amount in a perfect (suitability 1, quality 1) cell.
export const SPECIES_PEAK = 10;
// Amounts below this are treated as zero, giving crisp regions with real gaps.
export const AMOUNT_FLOOR = 0.6;
// Lowest habitat-quality factor; a cover class is never worthless where present.
export const Q_MIN = 0.4;

// How suitable each cover class is for each species (0..1). This is the whole
// point of the model: a few paintable classes, arbitrarily many derived species.
// Rows are species (matching SCENARIO.features ids); columns are cover classes.
export const SUITABILITY: Record<string, Record<CoverId, number>> = {
  forest: {
    forest: 1.0,
    wetland: 0.2,
    grassland: 0.1,
    cropland: 0.15,
    developed: 0,
    water: 0,
  },
  wetland: {
    forest: 0.15,
    wetland: 1.0,
    grassland: 0.1,
    cropland: 0.05,
    developed: 0,
    water: 0.3,
  },
  grassland: {
    forest: 0.1,
    wetland: 0.2,
    grassland: 1.0,
    cropland: 0.4,
    developed: 0,
    water: 0,
  },
};

export const SPECIES_IDS: readonly string[] = Object.keys(SUITABILITY);

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

// Per-species amounts for a cell of the given cover and habitat quality. Amounts
// below the floor are omitted, so an empty object means no habitat here.
export function amountsForCover(
  cover: CoverId,
  quality: number,
): Record<string, number> {
  const amounts: Record<string, number> = {};
  for (const species of SPECIES_IDS) {
    const suit = SUITABILITY[species]?.[cover] ?? 0;
    const value = round1(suit * quality * SPECIES_PEAK);
    if (value >= AMOUNT_FLOOR) amounts[species] = value;
  }
  return amounts;
}

// Cost of protecting a cell: the cover's base cost, nudged by a small,
// separate land-value / access variation (deliberately distinct from habitat
// quality, so the app never implies "better habitat costs more").
export function costForCover(cover: CoverId, costVar: number): number {
  return Math.max(1, Math.round(BASE_COST[cover] * (1 + costVar)));
}

export function baseCostOf(cover: CoverId): number {
  return BASE_COST[cover];
}

// A term-by-term breakdown of how a cell's amounts and cost are computed, for the
// cell inspector. Pure, so it is unit-tested and cannot drift from the actual
// derivation above.
export interface CellExplanation {
  cover: CoverId;
  quality: number;
  species: { id: string; suit: number; amount: number }[];
  cost: { base: number; costVar: number; value: number };
}

export function explainCover(
  cover: CoverId,
  quality: number,
  costVar: number,
): CellExplanation {
  const species = SPECIES_IDS.map((id) => {
    const suit = SUITABILITY[id]?.[cover] ?? 0;
    const raw = round1(suit * quality * SPECIES_PEAK);
    return { id, suit, amount: raw >= AMOUNT_FLOOR ? raw : 0 };
  });
  return {
    cover,
    quality,
    species,
    cost: { base: BASE_COST[cover], costVar, value: costForCover(cover, costVar) },
  };
}
