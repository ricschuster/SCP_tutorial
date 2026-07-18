import { useMemo } from 'react';
import { solve } from '../engine/index.ts';
import { toProblemFromUnits, type WorkingUnit } from '../data/scenario.ts';

interface CostTargetCurveProps {
  readonly units: readonly WorkingUnit[];
  readonly fractions: Record<string, number>;
  readonly focusId: string;
  readonly focusName: string;
  readonly color: string;
}

const STEPS = 10;
const W = 260;
const H = 150;
const PAD_L = 34;
const PAD_B = 26;
const PAD_T = 8;
const PAD_R = 8;

// Total cost as the focus feature's target is swept from 0 to 100%, holding the
// other features at their current targets. Shows the cost-versus-target tradeoff.
export function CostTargetCurve({
  units,
  fractions,
  focusId,
  focusName,
  color,
}: CostTargetCurveProps) {
  const { points, maxCost } = useMemo(() => {
    const pts: { t: number; cost: number | null }[] = [];
    let max = 1;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const solution = solve(toProblemFromUnits(units, { ...fractions, [focusId]: t }));
      const cost = solution.feasible ? solution.totalCost : null;
      if (cost !== null) max = Math.max(max, cost);
      pts.push({ t, cost });
    }
    return { points: pts, maxCost: max };
  }, [units, fractions, focusId]);

  const x = (t: number): number => PAD_L + t * (W - PAD_L - PAD_R);
  const y = (cost: number): number =>
    H - PAD_B - (cost / maxCost) * (H - PAD_B - PAD_T);

  const line = points
    .filter((p): p is { t: number; cost: number } => p.cost !== null)
    .map((p) => `${x(p.t).toFixed(1)},${y(p.cost).toFixed(1)}`)
    .join(' ');

  const current = fractions[focusId] ?? 0;
  const currentPoint = points.reduce((closest, p) =>
    Math.abs(p.t - current) < Math.abs(closest.t - current) ? p : closest,
  );

  return (
    <div className="panel curve">
      <div className="curve-head">
        <h2>Cost vs target</h2>
        <span className="curve-focus" style={{ color }}>
          {focusName}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="curve-svg"
        role="img"
        aria-label={`Total cost as the ${focusName} target changes`}
      >
        {/* axes */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="var(--border)" />
        <line
          x1={PAD_L}
          y1={H - PAD_B}
          x2={W - PAD_R}
          y2={H - PAD_B}
          stroke="var(--border)"
        />
        {/* curve */}
        <polyline points={line} fill="none" stroke={color} strokeWidth={2} />
        {/* current operating point */}
        {currentPoint.cost !== null && (
          <circle cx={x(currentPoint.t)} cy={y(currentPoint.cost)} r={4} fill={color} />
        )}
        {/* labels */}
        <text x={PAD_L - 4} y={PAD_T + 4} textAnchor="end" className="curve-tick">
          {Math.round(maxCost)}
        </text>
        <text x={PAD_L - 4} y={H - PAD_B} textAnchor="end" className="curve-tick">
          0
        </text>
        <text x={PAD_L} y={H - 6} textAnchor="start" className="curve-tick">
          0%
        </text>
        <text x={W - PAD_R} y={H - 6} textAnchor="end" className="curve-tick">
          100%
        </text>
      </svg>
      <p className="curve-note">
        Total cost as the {focusName} target rises (other targets held).
      </p>
    </div>
  );
}
