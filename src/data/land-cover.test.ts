import {
  amountsForCover,
  costForCover,
  COVERS,
  isCoverId,
  Q_MIN,
  SPECIES_PEAK,
} from './land-cover.ts';

test('a perfect-quality forest cell peaks the forest species and stays under it for others', () => {
  const amounts = amountsForCover('forest', 1);
  expect(amounts.forest).toBe(SPECIES_PEAK); // suitability 1.0 * quality 1 * 10
  // Cross-suitability is present but smaller.
  expect(amounts.grassland ?? 0).toBeLessThan(amounts.forest!);
});

test('developed cover is habitat for nothing', () => {
  expect(amountsForCover('developed', 1)).toEqual({});
});

test('amounts scale with habitat quality', () => {
  const hi = amountsForCover('forest', 1).forest!;
  const lo = amountsForCover('forest', Q_MIN).forest!;
  expect(lo).toBeLessThan(hi);
  expect(lo).toBeGreaterThan(0);
});

test('cost follows the cover base cost, nudged by variation, never below 1', () => {
  const forest = COVERS.find((c) => c.id === 'forest')!;
  expect(costForCover('forest', 0)).toBe(forest.baseCost);
  expect(costForCover('developed', 0)).toBeGreaterThan(costForCover('water', 0));
  expect(costForCover('water', -0.9)).toBeGreaterThanOrEqual(1);
});

test('isCoverId guards unknown values', () => {
  expect(isCoverId('forest')).toBe(true);
  expect(isCoverId('meadow')).toBe(false);
  expect(isCoverId(3)).toBe(false);
});
