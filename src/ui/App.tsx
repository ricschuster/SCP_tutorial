import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_TARGET_FRACTION } from '../engine/constants.ts';
import {
  solve,
  type Objective,
  type Solution,
  type SolveOptions,
} from '../engine/index.ts';
import { compareSolutions, type SolutionComparison } from '../engine/compare.ts';
import {
  costRangeOf,
  featureMaxOf,
  makeWorkingUnits,
  NEIGHBORS,
  SCENARIO,
  toProblemFromUnits,
  type WorkingUnit,
} from '../data/scenario.ts';
import { GridView } from './GridView.tsx';
import { CostTargetCurve } from './CostTargetCurve.tsx';
import { TourPanel } from './TourPanel.tsx';
import { TOUR_STEPS, type TourRegion } from './tour.ts';
import { hexToRgb, mix, type Rgb } from './color.ts';

const FEATURE_LO: Rgb = [245, 245, 245];
const COST_LO: Rgb = [235, 237, 232];
const COST_HI: Rgb = [60, 60, 60];
const SELECTED = 'rgb(27 120 55)';
const UNSELECTED = 'rgb(230 230 230)';
const LOCK_IN = '#1b7837';
const LOCK_OUT = '#c0392b';
const DIFF_BOTH = 'rgb(27 120 55)';
const DIFF_GREEDY = '#f9a825';
const DIFF_EXACT = '#1565c0';
const DIFF_NONE = 'rgb(235 235 235)';

const AMOUNT_MAX = 12;
const COST_MAX = 15;

type Tool = 'amount' | 'cost' | 'lockIn' | 'lockOut' | 'clear';

interface Brush {
  tool: Tool;
  featureId: string;
  amountValue: number;
  costValue: number;
}

const FIRST_FEATURE = SCENARIO.features[0]?.id ?? '';

function featureColor(id: string): string {
  return SCENARIO.features.find((f) => f.id === id)?.color ?? '#333';
}

function featureName(id: string): string {
  return SCENARIO.features.find((f) => f.id === id)?.name ?? id;
}

function applyBrush(unit: WorkingUnit, brush: Brush): WorkingUnit {
  switch (brush.tool) {
    case 'amount': {
      const amounts = { ...unit.amounts };
      if (brush.amountValue <= 0) delete amounts[brush.featureId];
      else amounts[brush.featureId] = brush.amountValue;
      return { ...unit, amounts };
    }
    case 'cost':
      return { ...unit, cost: Math.max(1, brush.costValue) };
    case 'lockIn':
      return { ...unit, status: 'locked-in' };
    case 'lockOut':
      return { ...unit, status: 'locked-out' };
    case 'clear':
      return { ...unit, status: 'available' };
    default:
      return unit;
  }
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'amount', label: 'Feature' },
  { id: 'cost', label: 'Cost' },
  { id: 'lockIn', label: 'Lock in' },
  { id: 'lockOut', label: 'Lock out' },
  { id: 'clear', label: 'Clear' },
];

// Colour each cell by how the greedy and exact solutions differ.
function diffFill(cmp: SolutionComparison): (unitId: number) => string {
  const both = new Set(cmp.both);
  const onlyGreedy = new Set(cmp.onlyGreedy);
  const onlyExact = new Set(cmp.onlyExact);
  return (id) =>
    both.has(id)
      ? DIFF_BOTH
      : onlyGreedy.has(id)
        ? DIFF_GREEDY
        : onlyExact.has(id)
          ? DIFF_EXACT
          : DIFF_NONE;
}

export function App() {
  const [units, setUnits] = useState<WorkingUnit[]>(() => makeWorkingUnits());
  const [edited, setEdited] = useState(false);
  const [fractions, setFractions] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const f of SCENARIO.features) init[f.id] = DEFAULT_TARGET_FRACTION;
    return init;
  });
  const [brush, setBrush] = useState<Brush>({
    tool: 'amount',
    featureId: FIRST_FEATURE,
    amountValue: 8,
    costValue: 6,
  });
  const [curveFocus, setCurveFocus] = useState(FIRST_FEATURE);
  const [objective, setObjective] = useState<Objective>('min-set');
  const [budgetPct, setBudgetPct] = useState(50);
  const [boundaryPenalty, setBoundaryPenalty] = useState(0);
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const f of SCENARIO.features) init[f.id] = 1;
    return init;
  });

  const totalLandscapeCost = useMemo(
    () => units.reduce((sum, u) => sum + u.cost, 0),
    [units],
  );
  const budget = Math.round((totalLandscapeCost * budgetPct) / 100);
  const solveOptions = useMemo<SolveOptions>(
    () => ({ objective, budget, weights, boundaryPenalty, neighbors: NEIGHBORS }),
    [objective, budget, weights, boundaryPenalty],
  );
  const solution = useMemo(
    () => solve(toProblemFromUnits(units, fractions), solveOptions),
    [units, fractions, solveOptions],
  );

  // Greedy-vs-exact comparison (minimum-set). The exact solver is loaded on
  // demand so it stays out of the initial bundle. Cleared when inputs change.
  const [comparison, setComparison] = useState<{
    exact: Solution;
    cmp: SolutionComparison;
  } | null>(null);
  const [comparing, setComparing] = useState(false);

  const runCompare = async () => {
    setComparing(true);
    const problem = toProblemFromUnits(units, fractions);
    const greedy = solve(problem);
    const { solveExact } = await import('../engine/exact.ts');
    const exact = solveExact(problem);
    setComparison({ exact, cmp: compareSolutions(greedy, exact) });
    setComparing(false);
  };
  const selectedSet = useMemo(() => new Set(solution.selected), [solution]);
  const unitsById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const costRange = useMemo(() => costRangeOf(units), [units]);
  const totalUnits = units.length;

  // Guided tour (lightweight: narrate + highlight an existing region).
  const rootRef = useRef<HTMLElement | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const tourActive = tourStep !== null;
  const currentStep = tourStep === null ? null : (TOUR_STEPS[tourStep] ?? null);

  useEffect(() => {
    if (currentStep === null) return;
    const el = rootRef.current?.querySelector(`[data-region="${currentStep.region}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentStep]);

  const tourHi = (key: TourRegion) =>
    currentStep?.region === key ? ' tour-highlight' : '';
  const nextStep = () =>
    setTourStep((s) => (s === null || s + 1 >= TOUR_STEPS.length ? null : s + 1));
  const backStep = () => setTourStep((s) => (s === null ? s : Math.max(0, s - 1)));

  const setFraction = (id: string, pct: number) => {
    setFractions((prev) => ({ ...prev, [id]: pct / 100 }));
    setComparison(null);
  };

  const paint = (id: number) => {
    setUnits((prev) => prev.map((u) => (u.id === id ? applyBrush(u, brush) : u)));
    setEdited(true);
    setComparison(null);
  };

  const reset = () => {
    setUnits(makeWorkingUnits());
    setEdited(false);
    setComparison(null);
  };

  const costFill = (id: number): string => {
    const cost = unitsById.get(id)?.cost ?? costRange.min;
    const span = costRange.max - costRange.min;
    const t = span > 0 ? (cost - costRange.min) / span : 0;
    return mix(COST_LO, COST_HI, t);
  };

  const featureFill = (featureId: string) => {
    const to = hexToRgb(featureColor(featureId));
    const max = featureMaxOf(units, featureId) || 1;
    return (id: number) =>
      mix(FEATURE_LO, to, (unitsById.get(id)?.amounts[featureId] ?? 0) / max);
  };

  const editFill = brush.tool === 'amount' ? featureFill(brush.featureId) : costFill;

  const statusBorder = (id: number): string | null => {
    const status = unitsById.get(id)?.status;
    if (status === 'locked-in') return LOCK_IN;
    if (status === 'locked-out') return LOCK_OUT;
    return null;
  };

  const editCaption =
    brush.tool === 'amount'
      ? `Edit: paint ${featureName(brush.featureId)}`
      : brush.tool === 'cost'
        ? 'Edit: paint cost'
        : brush.tool === 'lockIn'
          ? 'Edit: lock in (always protect)'
          : brush.tool === 'lockOut'
            ? 'Edit: lock out (never protect)'
            : 'Edit: clear lock status';

  return (
    <main className={tourActive ? 'app tour-active' : 'app'} ref={rootRef}>
      <div className={`title-row${tourHi('intro')}`} data-region="intro">
        <div>
          <h1>SCP Tutorial</h1>
          <p className="tagline">
            Set a target for each feature and paint the landscape. The solver picks the
            lowest-cost set of areas that meets every target, and re-solves as you
            change things.
          </p>
        </div>
        <button type="button" className="tour-start" onClick={() => setTourStep(0)}>
          Guided tour
        </button>
      </div>

      <div className="layout">
        <div className="sidebar">
          <section
            className={`panel controls${tourHi('targets')}`}
            data-region="targets"
          >
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
          </section>

          <section className={`panel controls${tourHi('edit')}`} data-region="edit">
            <h2>Edit tools</h2>
            <div className="tool-row">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={t.id === brush.tool ? 'tool tool-on' : 'tool'}
                  onClick={() => setBrush((b) => ({ ...b, tool: t.id }))}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {brush.tool === 'amount' && (
              <>
                <div className="tool-row">
                  {SCENARIO.features.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={f.id === brush.featureId ? 'tool tool-on' : 'tool'}
                      onClick={() => setBrush((b) => ({ ...b, featureId: f.id }))}
                    >
                      <span className="swatch" style={{ background: f.color }} />
                      {f.name.replace(' species', '')}
                    </button>
                  ))}
                </div>
                <label className="control">
                  <span className="control-label">Amount: {brush.amountValue}</span>
                  <input
                    type="range"
                    min={0}
                    max={AMOUNT_MAX}
                    value={brush.amountValue}
                    onChange={(e) =>
                      setBrush((b) => ({ ...b, amountValue: Number(e.target.value) }))
                    }
                  />
                </label>
              </>
            )}

            {brush.tool === 'cost' && (
              <label className="control">
                <span className="control-label">Cost: {brush.costValue}</span>
                <input
                  type="range"
                  min={1}
                  max={COST_MAX}
                  value={brush.costValue}
                  onChange={(e) =>
                    setBrush((b) => ({ ...b, costValue: Number(e.target.value) }))
                  }
                />
              </label>
            )}

            <div className="edit-actions">
              <span className="hint">Click or drag on the edit map.</span>
              <button
                type="button"
                className="reset"
                onClick={reset}
                disabled={!edited}
              >
                Reset landscape
              </button>
            </div>
          </section>

          <section className="panel controls">
            <h2>Method (advanced)</h2>
            <div className="tool-row">
              <button
                type="button"
                className={objective === 'min-set' ? 'tool tool-on' : 'tool'}
                onClick={() => setObjective('min-set')}
              >
                Minimum set
              </button>
              <button
                type="button"
                className={objective === 'max-coverage' ? 'tool tool-on' : 'tool'}
                onClick={() => setObjective('max-coverage')}
              >
                Max coverage
              </button>
            </div>

            {objective === 'max-coverage' && (
              <label className="control">
                <span className="control-label">
                  Budget: {budget} ({budgetPct}% of landscape)
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={budgetPct}
                  onChange={(e) => setBudgetPct(Number(e.target.value))}
                />
              </label>
            )}

            <label className="control">
              <span className="control-label">Compactness: {boundaryPenalty}</span>
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={boundaryPenalty}
                onChange={(e) => setBoundaryPenalty(Number(e.target.value))}
              />
            </label>

            <div className="control">
              <span className="control-label">Feature weights</span>
              {SCENARIO.features.map((f) => (
                <label className="weight-row" key={f.id}>
                  <span className="swatch" style={{ background: f.color }} />
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.5}
                    value={weights[f.id] ?? 1}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [f.id]: Number(e.target.value) }))
                    }
                  />
                  <span className="weight-val">{(weights[f.id] ?? 1).toFixed(1)}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

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
            {objective === 'max-coverage' && (
              <div className="stat">
                <span className="stat-label">Budget used</span>
                <span className="stat-value">
                  {solution.totalCost} / {budget}
                </span>
              </div>
            )}
            <div className="attainments">
              {solution.attainment.map((a) => {
                const pct = a.target > 0 ? Math.min(1, a.represented / a.target) : 1;
                return (
                  <div className="attain" key={a.featureId}>
                    <span className="attain-label">
                      {featureName(a.featureId)} {a.met ? '✓' : ''}
                    </span>
                    <span className="bar">
                      <span
                        className="bar-fill"
                        style={{
                          width: `${Math.round(pct * 100)}%`,
                          background: featureColor(a.featureId),
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
            {objective === 'min-set' && !solution.feasible && (
              <p className="warn">
                Targets cannot be met (too much locked out or too little habitat):{' '}
                {solution.shortfallFeatures.map(featureName).join(', ')}.
              </p>
            )}
            {objective === 'max-coverage' && solution.shortfallFeatures.length > 0 && (
              <p className="info">
                Not fully covered within budget:{' '}
                {solution.shortfallFeatures.map(featureName).join(', ')}.
              </p>
            )}
          </div>

          <div className="editor-row">
            <div className={`editor-map${tourHi('priority')}`} data-region="priority">
              <h2>Priority areas</h2>
              <div className="maps">
                <GridView
                  gridSize={SCENARIO.gridSize}
                  caption="Selected priorities"
                  fill={(id) => (selectedSet.has(id) ? SELECTED : UNSELECTED)}
                  selected={selectedSet}
                  border={statusBorder}
                />
                <GridView
                  gridSize={SCENARIO.gridSize}
                  caption={editCaption}
                  fill={editFill}
                  border={statusBorder}
                  onPaint={paint}
                />
              </div>
            </div>
            <div className={`curve-wrap${tourHi('curve')}`} data-region="curve">
              <CostTargetCurve
                units={units}
                fractions={fractions}
                focusId={curveFocus}
                focusName={featureName(curveFocus)}
                color={featureColor(curveFocus)}
              />
            </div>
          </div>

          <div className="curve-select">
            <span className="hint">Cost curve for:</span>
            {SCENARIO.features.map((f) => (
              <button
                key={f.id}
                type="button"
                className={f.id === curveFocus ? 'tool tool-on' : 'tool'}
                onClick={() => setCurveFocus(f.id)}
              >
                {f.name.replace(' species', '')}
              </button>
            ))}
          </div>

          <div className="panel compare">
            <div className="compare-head">
              <h2>Greedy vs exact optimum</h2>
              <button
                type="button"
                className="tool"
                onClick={runCompare}
                disabled={comparing}
              >
                {comparing ? 'Solving...' : 'Compute exact optimum'}
              </button>
            </div>
            {comparison === null ? (
              <p className="hint">
                Minimum-set only. Compares the greedy heuristic against the exact
                optimum for the current landscape and targets.
              </p>
            ) : comparison.exact.feasible ? (
              <div className="compare-body">
                <div className="stats">
                  <div className="stat">
                    <span className="stat-label">Greedy cost</span>
                    <span className="stat-value">{comparison.cmp.greedyCost}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Exact cost</span>
                    <span className="stat-value">{comparison.cmp.exactCost}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Gap</span>
                    <span className="stat-value">
                      {comparison.cmp.gap} ({comparison.cmp.gapPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="maps">
                  <GridView
                    gridSize={SCENARIO.gridSize}
                    caption="Both green; greedy-only amber; exact-only blue"
                    fill={diffFill(comparison.cmp)}
                  />
                </div>
              </div>
            ) : (
              <p className="info">
                The current targets are infeasible, so there is no exact optimum to
                compare.
              </p>
            )}
          </div>

          <div
            className={`feature-section${tourHi('features')}`}
            data-region="features"
          >
            <h2>Conservation features</h2>
            <div className="maps">
              {SCENARIO.features.map((f) => (
                <GridView
                  key={f.id}
                  gridSize={SCENARIO.gridSize}
                  caption={`${f.name} (darker = more)`}
                  fill={featureFill(f.id)}
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      {currentStep !== null && tourStep !== null && (
        <TourPanel
          step={currentStep}
          index={tourStep}
          total={TOUR_STEPS.length}
          onBack={backStep}
          onNext={nextStep}
          onClose={() => setTourStep(null)}
        />
      )}
    </main>
  );
}
