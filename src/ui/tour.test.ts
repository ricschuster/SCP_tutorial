import { TOUR_STEPS, type TourRegion } from './tour.ts';
import { SCENARIO } from '../data/scenario.ts';

const REGIONS: readonly TourRegion[] = [
  'intro',
  'features',
  'targets',
  'priority',
  'curve',
  'edit',
];

test('tour has steps with unique ids and non-empty text', () => {
  expect(TOUR_STEPS.length).toBeGreaterThan(0);
  const ids = new Set(TOUR_STEPS.map((s) => s.id));
  expect(ids.size).toBe(TOUR_STEPS.length);
  for (const step of TOUR_STEPS) {
    expect(step.title.length).toBeGreaterThan(0);
    expect(step.body.length).toBeGreaterThan(0);
  }
});

test('every step targets a known region', () => {
  for (const step of TOUR_STEPS) {
    expect(REGIONS).toContain(step.region);
  }
});

test('the tour includes the cover -> habitat -> cost act with valid inspect cells', () => {
  const ids = TOUR_STEPS.map((s) => s.id);
  for (const id of ['landcover', 'habitat', 'quality', 'cost']) {
    expect(ids).toContain(id);
  }
  // Any step that names a cell to inspect must reference a real unit.
  for (const step of TOUR_STEPS) {
    if (step.inspect !== undefined) {
      expect(SCENARIO.units.some((u) => u.id === step.inspect)).toBe(true);
    }
  }
});
