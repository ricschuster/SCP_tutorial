import { DEFAULT_TARGET_FRACTION, GRID_SIZE } from './constants.ts';

test('default target fraction is a proportion between 0 and 1', () => {
  expect(DEFAULT_TARGET_FRACTION).toBeGreaterThan(0);
  expect(DEFAULT_TARGET_FRACTION).toBeLessThanOrEqual(1);
});

test('grid size is a positive integer', () => {
  expect(GRID_SIZE).toBeGreaterThan(0);
  expect(Number.isInteger(GRID_SIZE)).toBe(true);
});
