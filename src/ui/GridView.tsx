import type { PointerEvent } from 'react';

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

// A square grid of planning units drawn as SVG rects. Purely presentational: the
// caller decides each cell's fill, border, and (optionally) what a paint does.
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
  const cell = 22;
  const size = gridSize * cell;
  const paintable = Boolean(onPaint);
  const clickable = paintable || Boolean(onInspect);
  const cells = [];

  for (let id = 0; id < gridSize * gridSize; id++) {
    const row = Math.floor(id / gridSize);
    const col = id % gridSize;
    const isSelected = selected?.has(id) ?? false;
    const isInspected = inspectedId === id;
    const statusColor = border?.(id) ?? null;
    const stroke = isInspected
      ? '#111'
      : (statusColor ?? (isSelected ? '#111' : 'rgba(0,0,0,0.1)'));
    const strokeWidth = isInspected ? 3 : statusColor ? 2.5 : isSelected ? 2 : 0.5;

    cells.push(
      <rect
        key={id}
        x={col * cell}
        y={row * cell}
        width={cell}
        height={cell}
        fill={fill(id)}
        stroke={stroke}
        strokeWidth={strokeWidth}
        {...(clickable
          ? {
              style: { cursor: paintable ? 'crosshair' : 'pointer' },
              onPointerDown: (e: PointerEvent<SVGRectElement>) => {
                e.preventDefault();
                onInspect?.(id);
                onPaint?.(id);
              },
              onPointerEnter: (e: PointerEvent<SVGRectElement>) => {
                if (e.buttons === 1) onPaint?.(id);
              },
            }
          : {})}
      />,
    );
  }

  return (
    <figure className="map">
      <figcaption>{caption}</figcaption>
      <svg
        className={paintable ? 'grid-svg grid-svg-editable' : 'grid-svg'}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={caption}
        {...(clickable ? { style: { touchAction: 'none' } } : {})}
      >
        {cells}
      </svg>
    </figure>
  );
}
