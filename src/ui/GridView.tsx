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
}: GridViewProps) {
  const cell = 22;
  const size = gridSize * cell;
  const interactive = Boolean(onPaint);
  const cells = [];

  for (let id = 0; id < gridSize * gridSize; id++) {
    const row = Math.floor(id / gridSize);
    const col = id % gridSize;
    const isSelected = selected?.has(id) ?? false;
    const statusColor = border?.(id) ?? null;
    const stroke = statusColor ?? (isSelected ? '#111' : 'rgba(0,0,0,0.1)');
    const strokeWidth = statusColor ? 2.5 : isSelected ? 2 : 0.5;

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
        {...(interactive
          ? {
              style: { cursor: 'crosshair' },
              onPointerDown: (e: PointerEvent<SVGRectElement>) => {
                e.preventDefault();
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
        className={interactive ? 'grid-svg grid-svg-editable' : 'grid-svg'}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={caption}
        {...(interactive ? { style: { touchAction: 'none' } } : {})}
      >
        {cells}
      </svg>
    </figure>
  );
}
