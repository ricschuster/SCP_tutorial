import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import { CELL, cellIndexAt, cellStroke } from './grid-draw.ts';

interface GridViewProps {
  readonly gridSize: number;
  readonly fill: (unitId: number) => string;
  readonly caption: string;
  // When provided, these units are outlined (used for the priority map).
  readonly selected?: ReadonlySet<number>;
  // Optional per-cell border colour (used to show lock-in / lock-out status).
  readonly border?: (unitId: number) => string | null;
  // When provided, the grid is paintable: pointer down or drag applies to a cell.
  readonly onPaint?: (unitId: number) => void;
  // When provided, clicking a cell selects it (used to drive the cell inspector).
  readonly onInspect?: (unitId: number) => void;
  // The currently inspected cell, marked on the grid.
  readonly inspectedId?: number | null;
}

const GRID_LINE = 'rgba(0,0,0,0.1)';

// A square grid of planning units drawn on a single <canvas>. Purely
// presentational: the caller decides each cell's fill, border, and (optionally)
// what a paint does. Canvas keeps one DOM node per map instead of gridSize^2
// rects, so it stays smooth as the landscape grows (see the canvas design note).
export function GridView({
  gridSize,
  fill,
  caption,
  selected,
  border,
  onPaint,
  onInspect,
  inspectedId,
}: GridViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // The last cell a drag painted, so pointermove paints once per cell crossed
  // rather than repeatedly while the pointer sits inside one cell.
  const lastPaintedRef = useRef<number | null>(null);
  const paintable = Boolean(onPaint);
  const clickable = paintable || Boolean(onInspect);
  const size = gridSize * CELL;

  // Redraw after every commit: fill, border, and selected are fresh closures
  // each render, and the parent re-renders whenever any of them change. Drawing
  // ~900 cells to a canvas is well under a millisecond, so this is cheap.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    // jsdom has no 2D context; the component still mounts (tests rely on that).
    if (ctx === null) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // Pass 1: cell fills.
    for (let id = 0; id < gridSize * gridSize; id++) {
      const row = Math.floor(id / gridSize);
      const col = id % gridSize;
      ctx.fillStyle = fill(id);
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }

    // Pass 2: the light background grid, drawn once as lines.
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i <= gridSize; i++) {
      const p = i * CELL;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();

    // Pass 3: emphasized outlines (inspected / lock status / selected) on top, so
    // a neighbour's fill never clips them. Inset by half the line width so the
    // whole stroke stays inside the cell.
    for (let id = 0; id < gridSize * gridSize; id++) {
      const stroke = cellStroke({
        isInspected: inspectedId === id,
        statusColor: border?.(id) ?? null,
        isSelected: selected?.has(id) ?? false,
      });
      if (stroke === null) continue;
      const row = Math.floor(id / gridSize);
      const col = id % gridSize;
      const inset = stroke.width / 2;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.strokeRect(
        col * CELL + inset,
        row * CELL + inset,
        CELL - stroke.width,
        CELL - stroke.width,
      );
    }
  });

  const cellFrom = (e: PointerEvent<HTMLCanvasElement>): number | null => {
    const canvas = canvasRef.current;
    if (canvas === null) return null;
    return cellIndexAt(e.clientX, e.clientY, canvas.getBoundingClientRect(), gridSize);
  };

  return (
    <figure className="map">
      <figcaption>{caption}</figcaption>
      <canvas
        ref={canvasRef}
        className={paintable ? 'grid-canvas grid-canvas-editable' : 'grid-canvas'}
        role="img"
        aria-label={caption}
        {...(clickable
          ? {
              style: {
                cursor: paintable ? 'crosshair' : 'pointer',
                touchAction: 'none',
              },
              onPointerDown: (e: PointerEvent<HTMLCanvasElement>) => {
                e.preventDefault();
                const id = cellFrom(e);
                if (id === null) return;
                lastPaintedRef.current = id;
                onInspect?.(id);
                onPaint?.(id);
              },
              // One canvas covers the whole grid, so drag painting rides
              // pointermove (not per-cell pointerenter as with the old rects).
              // Paint only when the pointer crosses into a new cell, so a
              // toggling tool (lock in/out) fires once per cell, not per pixel.
              onPointerMove: (e: PointerEvent<HTMLCanvasElement>) => {
                if (e.buttons !== 1) return;
                const id = cellFrom(e);
                if (id === null || id === lastPaintedRef.current) return;
                lastPaintedRef.current = id;
                onPaint?.(id);
              },
              onPointerUp: () => {
                lastPaintedRef.current = null;
              },
            }
          : {})}
      />
    </figure>
  );
}
