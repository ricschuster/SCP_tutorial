import { useMemo, useState } from 'react';
import { DEFAULT_TARGET_FRACTION } from '../engine/constants.ts';
import { solve } from '../engine/index.ts';
import { COST_RANGE, featureMax, SCENARIO, toProblem } from '../data/scenario.ts';
import { GridView } from './GridView.tsx';
import { hexToRgb, mix, type Rgb } from './color.ts';

const FEATURE_LO: Rgb = [245, 245, 245];
const COST_LO: Rgb = [235, 237, 232];
const COST_HI: Rgb = [60, 60, 60];
const SELECTED = 'rgb(27 120 55)';
const UNSELECTED = 'rgb(230 230 230)';

function costFill(unitId: number): string {
  const cost = SCENARIO.units[unitId]?.cost ?? COST_RANGE.min;
  const span = COST_RANGE.max - COST_RANGE.min;
  const t = span > 0 ? (cost - COST_RANGE.min) / span : 0;
  return mix(COST_LO, COST_HI, t);
}

export function App() {
  const [fractions, setFractions] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const f of SCENARIO.features) init[f.id] = DEFAULT_TARGET_FRACTION;
    return init;
  });

  const solution = useMemo(() => solve(toProblem(fractions)), [fractions]);
  const selectedSet = useMemo(() => new Set(solution.selected), [solution]);
  const totalUnits = SCENARIO.units.length;

  const setFraction = (id: string, pct: number) =>
    setFractions((prev) => ({ ...prev, [id]: pct / 100 }));

  return (
    <main className="app">
      <h1>SCP Tutorial</h1>
      <p className="tagline">
        Set a representation target for each feature. The solver picks the lowest-cost
        set of areas that meets every target.
      </p>

      <div className="layout">
        <section className="panel controls">
          <h2>Targets</h2>
          {SCENARIO.features.map((f) => {
            const pct = Math.round((fractions[f.id] ?? 0) * 100);
            return (
              <label className="control" key={f.id}>
                <span className="control-label">
                  <span className="swatch" style={{ background: f.color }} />
                  {f.name}: {pct}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pct}
                  onChange={(e) => setFraction(f.id, Number(e.target.value))}
                />
              </label>
            );
          })}
          <p className="hint">Priorities update as you drag.</p>
        </section>

        <section className="results">
          <div className="panel stats">
            <div className="stat">
              <span className="stat-label">Total cost</span>
              <span className="stat-value">{solution.totalCost}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Areas selected</span>
              <span className="stat-value">
                {solution.selected.length} / {totalUnits}
              </span>
            </div>
            <div className="attainments">
              {solution.attainment.map((a) => {
                const f = SCENARIO.features.find((x) => x.id === a.featureId);
                const pct = a.target > 0 ? Math.min(1, a.represented / a.target) : 1;
                return (
                  <div className="attain" key={a.featureId}>
                    <span className="attain-label">
                      {f?.name ?? a.featureId} {a.met ? '✓' : ''}
                    </span>
                    <span className="bar">
                      <span
                        className="bar-fill"
                        style={{
                          width: `${Math.round(pct * 100)}%`,
                          background: f?.color ?? SELECTED,
                        }}
                      />
                    </span>
                    <span className="attain-num">
                      {Math.round(a.represented)} / {Math.round(a.target)}
                    </span>
                  </div>
                );
              })}
            </div>
            {!solution.feasible && (
              <p className="warn">
                Targets cannot be met: {solution.shortfallFeatures.join(', ')}.
              </p>
            )}
          </div>

          <h2>Priority areas</h2>
          <div className="maps">
            <GridView
              gridSize={SCENARIO.gridSize}
              caption="Selected priorities"
              fill={(id) => (selectedSet.has(id) ? SELECTED : UNSELECTED)}
              selected={selectedSet}
            />
            <GridView
              gridSize={SCENARIO.gridSize}
              caption="Cost (darker = costlier)"
              fill={costFill}
            />
          </div>

          <h2>Conservation features</h2>
          <div className="maps">
            {SCENARIO.features.map((f) => {
              const max = featureMax(f.id) || 1;
              const to = hexToRgb(f.color);
              return (
                <GridView
                  key={f.id}
                  gridSize={SCENARIO.gridSize}
                  caption={`${f.name} (darker = more)`}
                  fill={(id) =>
                    mix(FEATURE_LO, to, (SCENARIO.units[id]?.amounts[f.id] ?? 0) / max)
                  }
                />
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
