// Pure helpers for the canvas grid: hit testing and border precedence. Kept free
// of the canvas API so they are unit-testable without a 2D context (jsdom does
// not implement one). GridView owns the actual drawing; these decide what.

// Logical pixels per cell in the canvas coordinate space. The canvas is scaled
// to its CSS box, so this is an internal resolution, not an on-screen size.
export const CELL = 22;

export interface Stroke {
  readonly color: string;
  readonly width: number;
}

// The emphasized outline for a cell, matching the old SVG precedence:
// inspected beats a lock/status border beats the selected outline. Cells with no
// emphasis return null and get only the light background grid.
export function cellStroke(opts: {
  readonly isInspected: boolean;
  readonly statusColor: string | null;
  readonly isSelected: boolean;
}): Stroke | null {
  if (opts.isInspected) return { color: '#111', width: 3 };
  if (opts.statusColor !== null) return { color: opts.statusColor, width: 2.5 };
  if (opts.isSelected) return { color: '#111', width: 2 };
  return null;
}

export interface ClientRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

// Map a pointer position (client coordinates) to a cell id, using the canvas's
// on-screen box. Returns null when the box has no size (nothing rendered yet) or
// the point falls outside the grid.
export function cellIndexAt(
  clientX: number,
  clientY: number,
  rect: ClientRect,
  gridSize: number,
): number | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const col = Math.floor(((clientX - rect.left) / rect.width) * gridSize);
  const row = Math.floor(((clientY - rect.top) / rect.height) * gridSize);
  if (col < 0 || col >= gridSize || row < 0 || row >= gridSize) return null;
  return row * gridSize + col;
}
