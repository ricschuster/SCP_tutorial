import { cellIndexAt, cellStroke } from './grid-draw.ts';

const rect = { left: 0, top: 0, width: 300, height: 300 };

test('cellIndexAt maps a point to the right cell', () => {
  // 10x10 over a 300px box: each cell is 30px. (45, 75) is col 1, row 2.
  expect(cellIndexAt(45, 75, rect, 10)).toBe(2 * 10 + 1);
});

test('cellIndexAt honours the box offset', () => {
  const offset = { left: 100, top: 50, width: 300, height: 300 };
  // Relative point (45, 75) again, shifted by the offset.
  expect(cellIndexAt(145, 125, offset, 10)).toBe(2 * 10 + 1);
});

test('cellIndexAt returns null outside the grid', () => {
  expect(cellIndexAt(-1, 10, rect, 10)).toBeNull();
  expect(cellIndexAt(10, 305, rect, 10)).toBeNull();
});

test('cellIndexAt returns null when the box has no size', () => {
  expect(cellIndexAt(5, 5, { left: 0, top: 0, width: 0, height: 0 }, 10)).toBeNull();
});

test('cellStroke precedence: inspected beats status beats selected', () => {
  expect(
    cellStroke({ isInspected: true, statusColor: '#7b1fa2', isSelected: true }),
  ).toEqual({ color: '#111', width: 3 });
  expect(
    cellStroke({ isInspected: false, statusColor: '#7b1fa2', isSelected: true }),
  ).toEqual({ color: '#7b1fa2', width: 2.5 });
  expect(
    cellStroke({ isInspected: false, statusColor: null, isSelected: true }),
  ).toEqual({ color: '#111', width: 2 });
});

test('cellStroke returns null for an unemphasized cell', () => {
  expect(
    cellStroke({ isInspected: false, statusColor: null, isSelected: false }),
  ).toBeNull();
});
