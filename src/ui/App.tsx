import { useEffect, useMemo, useRef, useState } from 'react';
import {
  solve,
  type Objective,
  type Solution,
  type SolveOptions,
} from '../engine/index.ts';
import { compareSolutions, type SolutionComparison } from '../engine/compare.ts';
import {
  applyCover,
  costRangeOf,
  featureMaxOf,
  makeWorkingUnits,
  NEIGHBORS,
  SCENARIO,
  toProblemFromUnits,
  type WorkingUnit,
} from '../data/scenario.ts';
import { COVERS, type CoverId } from '../data/land-cover.ts';
import {
  decodeState,
  defaultState,
  encodeState,
  hasUnitEdits,
  isDefaultState,
  type ScenarioState,
} from '../data/share.ts';
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
// Lock-in is violet, deliberately distinct from the selected-priority green it
// would otherwise share a border/fill with. Lock-out stays red.
const LOCK_IN = '#7b1fa2';
const LOCK_OUT = '#c0392b';
const DIFF_BOTH = 'rgb(27 120 55)';
const DIFF_GREEDY = '#f9a825';
const DIFF_EXACT = '#1565c0';
const DIFF_NONE = 'rgb(235 235 235)';

const FIRST_COVER: CoverId = COVERS[0]?.id ?? 'forest';

function coverColor(id: CoverId): string {
  return COVERS.find((c) => c.id === id)?.color ?? '#999';
}

function coverName(id: CoverId): string {
  return COVERS.find((c) => c.id === id)?.name ?? id;
}

// Legend for the priority map. Built from the color constants so they stay the
// single source of truth. "fill" swatches are solid; "border" swatches match how
// lock status shows on the map (a colored outline).
const LEGEND: { label: string; kind: 'fill' | 'border'; color: string }[] = [
  { label: 'Selected', kind: 'fill', color: SELECTED },
  { label: 'Locked in', kind: 'border', color: LOCK_IN },
  { label: 'Locked out', kind: 'border', color: LOCK_OUT },
];

type Tool = 'cover' | 'lockIn' | 'lockOut' | 'clear';

interface Brush {
  tool: Tool;
  cover: CoverId;
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
    case 'cover':
      // Repaint cover; amounts and cost re-derive from the new cover.
      return applyCover(unit, brush.cover);
    case 'lockIn':
      // Toggle: clicking a locked-in cell with this tool clears it.
      return {
        ...unit,
        status: unit.status === 'locked-in' ? 'available' : 'locked-in',
      };
    case 'lockOut':
      return {
        ...unit,
        status: unit.status === 'locked-out' ? 'available' : 'locked-out',
      };
    case 'clear':
      return { ...unit, status: 'available' };
    default:
      return unit;
  }
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'cover', label: 'Paint cover' },
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
  // Hydrate from a shared link if the URL carries one, else the default
  // scenario. Read once on mount so the whole state starts from one snapshot.
  const [initial] = useState<ScenarioState>(() => {
    const fromUrl =
      typeof window !== 'undefined' ? decodeState(window.location.hash.slice(1)) : null;
    return fromUrl ?? defaultState();
  });

  const [units, setUnits] = useState<WorkingUnit[]>(() => initial.units);
  const [edited, setEdited] = useState(() => hasUnitEdits(initial.units));
  const [fractions, setFractions] = useState<Record<string, number>>(
    () => initial.fractions,
  );
  const [brush, setBrush] = useState<Brush>({
    tool: 'cover',
    cover: FIRST_COVER,
  });
  const [curveFocus, setCurveFocus] = useState(FIRST_FEATURE);
  const [objective, setObjective] = useState<Objective>(() => initial.objective);
  const [budgetPct, setBudgetPct] = useState(() => initial.budgetPct);
  const [boundaryPenalty, setBoundaryPenalty] = useState(() => initial.boundaryPenalty);
  const [weights, setWeights] = useState<Record<string, number>>(() => initial.weights);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const exact = await solveExact(problem);
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

  // Keep the URL in sync with the shareable state, so the current scenario can
  // be bookmarked or copied. A default scenario yields a clean URL (no hash).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const state: ScenarioState = {
      fractions,
      weights,
      objective,
      budgetPct,
      boundaryPenalty,
      units,
    };
    const base = `${window.location.pathname}${window.location.search}`;
    const url = isDefaultState(state) ? base : `${base}#${encodeState(state)}`;
    window.history.replaceState(null, '', url);
  }, [fractions, weights, objective, budgetPct, boundaryPenalty, units]);

  // Clear the pending "Link copied" timer if the app unmounts mid-feedback.
  useEffect(
    () => () => {
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    },
    [],
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      return;
    }
    setCopied(true);
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

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

  const coverFill = (id: number): string => {
    const cover = unitsById.get(id)?.cover;
    return cover ? coverColor(cover) : UNSELECTED;
  };

  const statusBorder = (id: number): string | null => {
    const status = unitsById.get(id)?.status;
    if (status === 'locked-in') return LOCK_IN;
    if (status === 'locked-out') return LOCK_OUT;
    return null;
  };

  const editCaption =
    brush.tool === 'cover'
      ? `Edit: paint ${coverName(brush.cover)}`
      : brush.tool === 'lockIn'
        ? 'Edit: lock in (click to toggle; always protected)'
        : brush.tool === 'lockOut'
          ? 'Edit: lock out (click to toggle; never selected)'
          : 'Edit: clear lock status';

  return (
    <main className={tourActive ? 'app tour-active' : 'app'} ref={rootRef}>
      <div className={`title-row${tourHi('intro')}`} data-region="intro">
        <div>
          <h1>SCP Tutorial</h1>
          <p className="tagline">
            Set a target for each species and paint land cover on the map. Habitat and
            cost follow from the cover. The solver picks the lowest-cost set of areas
            that meets every target, and re-solves as you change things.
          </p>
        </div>
        <div className="title-actions">
          <button
            type="button"
            className="tour-start secondary"
            onClick={copyLink}
            title="Copy a link to the current scenario"
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button type="button" className="tour-start" onClick={() => setTourStep(0)}>
            Guided tour
          </button>
        </div>
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

            {brush.tool === 'cover' && (
              <div className="tool-row">
                {COVERS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={c.id === brush.cover ? 'tool tool-on' : 'tool'}
                    onClick={() => setBrush((b) => ({ ...b, cover: c.id }))}
                  >
                    <span className="swatch" style={{ background: c.color }} />
                    {c.name}
                  </button>
                ))}
              </div>
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
                  fill={coverFill}
                  border={statusBorder}
                  onPaint={paint}
                />
              </div>
              <ul className="legend">
                {LEGEND.map((item) => (
                  <li key={item.label}>
                    <span
                      className="legend-swatch"
                      style={
                        item.kind === 'fill'
                          ? { background: item.color }
                          : {
                              border: `2px solid ${item.color}`,
                              background: 'var(--surface)',
                            }
                      }
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
              <ul className="legend">
                {COVERS.map((c) => (
                  <li key={c.id}>
                    <span className="legend-swatch" style={{ background: c.color }} />
                    {c.name}
                  </li>
                ))}
              </ul>
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
            <h2>Derived from land cover</h2>
            <p className="hint">
              Cost and each species&apos; habitat are computed from the cover you paint,
              not set directly.
            </p>
            <div className="maps">
              <GridView
                gridSize={SCENARIO.gridSize}
                caption="Cost to protect (darker = pricier)"
                fill={costFill}
              />
              {SCENARIO.features.map((f) => (
                <GridView
                  key={f.id}
                  gridSize={SCENARIO.gridSize}
                  caption={`${f.name} habitat (darker = more)`}
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
