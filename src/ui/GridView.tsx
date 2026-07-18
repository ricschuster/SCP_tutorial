interface GridViewProps {
  readonly gridSize: number;
  readonly fill: (unitId: number) => string;
  readonly caption: string;
  // When provided, these units are outlined (used for the priority map).
  readonly selected?: ReadonlySet<number>;
}

// A square grid of planning units drawn as SVG rects. Purely presentational: the
// caller decides each cell's fill.
export function GridView({ gridSize, fill, caption, selected }: GridViewProps) {
  const cell = 22;
  const size = gridSize * cell;
  const cells = [];

  for (let id = 0; id < gridSize * gridSize; id++) {
    const row = Math.floor(id / gridSize);
    const col = id % gridSize;
    const isSelected = selected?.has(id) ?? false;
    cells.push(
      <rect
        key={id}
        x={col * cell}
        y={row * cell}
        width={cell}
        height={cell}
        fill={fill(id)}
        stroke={isSelected ? '#111' : 'rgba(0,0,0,0.1)'}
        strokeWidth={isSelected ? 2 : 0.5}
      />,
    );
  }

  return (
    <figure className="map">
      <figcaption>{caption}</figcaption>
      <svg
        className="grid-svg"
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={caption}
      >
        {cells}
      </svg>
    </figure>
  );
}
