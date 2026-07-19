import { useEffect, useMemo, useRef, useState } from 'react';
import {
  irreplaceability,
  solve,
  type Objective,
  type Solution,
  type SolveOptions,
} from '../engine/index.ts';
import {
  compareSolutions,
  compareCoverage,
  type SelectionDiff,
  type SolutionComparison,
  type CoverageComparison,
} from '../engine/compare.ts';
import {
  applyCover,
  combinedHabitatMaxOf,
  combinedHabitatOf,
  costRangeOf,
  featureMaxOf,
  makeWorkingUnits,
  NEIGHBORS,
  SCENARIO,
  toProblemFromUnits,
  type WorkingUnit,
} from '../data/scenario.ts';
import { buildConnectivity } from '../data/connectivity.ts';
import {
  baseCostOf,
  COVERS,
  explainCover,
  SPECIES_PEAK,
  SUITABILITY,
  type CoverId,
} from '../data/land-cover.ts';
import {
  decodeState,
  defaultState,
  encodeState,
  hasUnitEdits,
  isDefaultState,
  type AppView,
  type ScenarioState,
} from '../data/share.ts';
import { GridView } from './GridView.tsx';
import { CostTargetCurve } from './CostTargetCurve.tsx';
import { TourPanel } from './TourPanel.tsx';
import { SHORT_TOUR_LENGTH, TOUR_STEPS, type TourRegion } from './tour.ts';
import { mix, type Rgb } from './color.ts';

// Habitat scalar ramp (single hue for every habitat map, so feature identity is
// never carried by map colour). Distinct enough from the solid priority green.
const HAB_LO: Rgb = [245, 245, 245];
const HAB_HI: Rgb = [21, 87, 36];
const COST_LO: Rgb = [235, 237, 232];
const COST_HI: Rgb = [60, 60, 60];
// Irreplaceability heat: a light-to-warm sequential ramp (ColorBrewer OrRd),
// deliberately distinct from the selected green, lock violet, and diff blue.
const IRREP_LO: Rgb = [255, 247, 236];
const IRREP_HI: Rgb = [179, 0, 0];
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

// Coverage as a percentage of the achievable ceiling, e.g. "88.2%".
function coveragePctLabel(value: number, max: number): string {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return `${pct.toFixed(1)}%`;
}

// Colour each cell by how the greedy and exact solutions differ.
function diffFill(cmp: SelectionDiff): (unitId: number) => string {
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
  const [inspected, setInspected] = useState<number | null>(null);
  const [showIrrep, setShowIrrep] = useState(false);
  // Which species the habitat spotlight map shows (single-hue scalar surface).
  const [spotlight, setSpotlight] = useState(FIRST_FEATURE);
  const [view, setView] = useState<AppView>(() => initial.view);
  const [curveFocus, setCurveFocus] = useState(FIRST_FEATURE);
  const [objective, setObjective] = useState<Objective>(() => initial.objective);
  const [budgetPct, setBudgetPct] = useState(() => initial.budgetPct);
  const [boundaryPenalty, setBoundaryPenalty] = useState(() => initial.boundaryPenalty);
  const [connectivityPenalty, setConnectivityPenalty] = useState(
    () => initial.connectivityPenalty,
  );
  const [sameCover, setSameCover] = useState(() => initial.sameCover);
  const [weights, setWeights] = useState<Record<string, number>>(() => initial.weights);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalLandscapeCost = useMemo(
    () => units.reduce((sum, u) => sum + u.cost, 0),
    [units],
  );
  const budget = Math.round((totalLandscapeCost * budgetPct) / 100);
  // The connectivity matrix is only needed when the penalty is on. The same-cover
  // (functional) boost reads each cell's cover, so rebuild when covers change.
  const connectivity = useMemo(
    () =>
      connectivityPenalty > 0 ? buildConnectivity(units, { sameCover }) : undefined,
    [connectivityPenalty, sameCover, units],
  );
  const solveOptions = useMemo<SolveOptions>(
    () => ({
      objective,
      budget,
      weights,
      boundaryPenalty,
      neighbors: NEIGHBORS,
      connectivityPenalty,
      ...(connectivity ? { connectivity } : {}),
    }),
    [objective, budget, weights, boundaryPenalty, connectivityPenalty, connectivity],
  );
  const solution = useMemo(
    () => solve(toProblemFromUnits(units, fractions), solveOptions),
    [units, fractions, solveOptions],
  );

  // Greedy-vs-near-optimal comparison for the current objective. The exact solver
  // is loaded on demand so it stays out of the initial bundle. Cleared when any
  // input that defines the compared problem changes. Both sides drop the greedy
  // penalties so the only difference measured is heuristic vs optimum.
  const [comparison, setComparison] = useState<
    | { kind: 'min-set'; exact: Solution; cmp: SolutionComparison }
    | { kind: 'max-coverage'; exact: Solution; cmp: CoverageComparison }
    | null
  >(null);
  const [comparing, setComparing] = useState(false);

  const runCompare = async () => {
    setComparing(true);
    const problem = toProblemFromUnits(units, fractions);
    if (objective === 'max-coverage') {
      const greedy = solve(problem, { objective: 'max-coverage', budget, weights });
      const { solveExactMaxCoverage } = await import('../engine/exact.ts');
      const exact = await solveExactMaxCoverage(problem, { budget, weights });
      setComparison({
        kind: 'max-coverage',
        exact,
        cmp: compareCoverage(greedy, exact, weights),
      });
    } else {
      const greedy = solve(problem);
      const { solveExact } = await import('../engine/exact.ts');
      const exact = await solveExact(problem);
      setComparison({ kind: 'min-set', exact, cmp: compareSolutions(greedy, exact) });
    }
    setComparing(false);
  };
  const selectedSet = useMemo(() => new Set(solution.selected), [solution]);

  // Irreplaceability heat: how often each unit appears across a portfolio of
  // cost-perturbed near-optimal plans. Computed only while the layer is on (it
  // runs many solves), and with the current solve options so the heat matches
  // the objective the learner is looking at.
  const irrep = useMemo(
    () =>
      showIrrep
        ? irreplaceability(toProblemFromUnits(units, fractions), { solveOptions })
        : null,
    [showIrrep, units, fractions, solveOptions],
  );
  const unitsById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const inspectedUnit = inspected === null ? null : (unitsById.get(inspected) ?? null);
  const inspectedExplain = inspectedUnit
    ? explainCover(inspectedUnit.cover, inspectedUnit.quality, inspectedUnit.costVar)
    : null;
  const costRange = useMemo(() => costRangeOf(units), [units]);
  const totalUnits = units.length;

  // Guided tour: narrate + highlight a region + perform the step's control
  // actions. `fullTour` tracks whether the learner continued past the short tour.
  const rootRef = useRef<HTMLElement | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [fullTour, setFullTour] = useState(false);
  const tourActive = tourStep !== null;
  const currentStep = tourStep === null ? null : (TOUR_STEPS[tourStep] ?? null);
  // The number of steps in the current scope (short by default).
  const tourTotal = fullTour ? TOUR_STEPS.length : SHORT_TOUR_LENGTH;
  // Pre-tour state to restore when the tour closes, so it never leaves the app
  // with the irreplaceability layer on or the connectivity knob turned up.
  const tourSnapshot = useRef<{
    view: AppView;
    showIrrep: boolean;
    spotlight: string;
    connectivityPenalty: number;
    inspected: number | null;
  } | null>(null);

  useEffect(() => {
    if (currentStep === null) return;
    // Steps that call out a cell teach through the inspector, so bring that into
    // view (not just the maps region), or the arithmetic the step describes is
    // below the fold on a normal screen.
    const selector =
      currentStep.inspect !== undefined
        ? '.inspector'
        : `[data-region="${currentStep.region}"]`;
    const el = rootRef.current?.querySelector(selector);
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
      connectivityPenalty,
      sameCover,
      view,
      units,
    };
    const base = `${window.location.pathname}${window.location.search}`;
    const url = isDefaultState(state) ? base : `${base}#${encodeState(state)}`;
    window.history.replaceState(null, '', url);
  }, [
    fractions,
    weights,
    objective,
    budgetPct,
    boundaryPenalty,
    connectivityPenalty,
    sameCover,
    view,
    units,
  ]);

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

  // Apply a tour step (or close the tour). Each step declares the full control
  // state it wants, so this sets exactly those and clears the rest to their tour
  // defaults; steps are therefore order-independent. Doing this in the handler,
  // not an effect, keeps the tab switch and control changes explicit actions.
  const goToStep = (step: number | null) => {
    if (step === null) {
      const snap = tourSnapshot.current;
      if (snap) {
        setView(snap.view);
        setShowIrrep(snap.showIrrep);
        setSpotlight(snap.spotlight);
        setConnectivityPenalty(snap.connectivityPenalty);
        setInspected(snap.inspected);
        tourSnapshot.current = null;
      }
      setTourStep(null);
      return;
    }
    const s = TOUR_STEPS[step];
    if (!s) return;
    setView(s.tab);
    setInspected(s.inspect ?? null);
    setShowIrrep(s.showIrrep ?? false);
    setSpotlight(s.spotlight ?? FIRST_FEATURE);
    setConnectivityPenalty(s.connectivityPenalty ?? 0);
    setTourStep(step);
    // Steps that show the greedy-vs-near-optimal comparison solve it on entry, so
    // the learner lands on a computed result instead of an empty panel.
    if (s.compute) void runCompare();
  };

  const startTour = () => {
    tourSnapshot.current = {
      view,
      showIrrep,
      spotlight,
      connectivityPenalty,
      inspected,
    };
    setFullTour(false);
    goToStep(0);
  };
  const continueFullTour = () => {
    setFullTour(true);
    goToStep(SHORT_TOUR_LENGTH);
  };
  const nextStep = () => {
    if (tourStep === null) return;
    const scopeEnd = (fullTour ? TOUR_STEPS.length : SHORT_TOUR_LENGTH) - 1;
    goToStep(tourStep >= scopeEnd ? null : tourStep + 1);
  };
  const backStep = () => {
    if (tourStep !== null) goToStep(Math.max(0, tourStep - 1));
  };

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

  // Full reset: revert every knob to its default, as if freshly loaded with no
  // share hash. Unlike "Reset landscape" (units only), this also clears targets,
  // objective/budget/weights, penalties, the spotlight/irreplaceability layer,
  // the inspector, the active tab, and the URL hash. Confirm first when there is
  // work to lose so an accidental click does not wipe a lot of changes.
  const startOver = () => {
    const current: ScenarioState = {
      fractions,
      weights,
      objective,
      budgetPct,
      boundaryPenalty,
      connectivityPenalty,
      sameCover,
      view,
      units,
    };
    const clean = isDefaultState(current) && !showIrrep && inspected === null;
    if (!clean && typeof window !== 'undefined') {
      const ok = window.confirm(
        'Start over? This clears every change and returns to the default scenario.',
      );
      if (!ok) return;
    }
    const d = defaultState();
    setUnits(d.units);
    setEdited(false);
    setFractions(d.fractions);
    setWeights(d.weights);
    setObjective(d.objective);
    setBudgetPct(d.budgetPct);
    setBoundaryPenalty(d.boundaryPenalty);
    setConnectivityPenalty(d.connectivityPenalty);
    setSameCover(d.sameCover);
    setView(d.view);
    setSpotlight(FIRST_FEATURE);
    setCurveFocus(FIRST_FEATURE);
    setShowIrrep(false);
    setInspected(null);
    setBrush({ tool: 'cover', cover: FIRST_COVER });
    setComparison(null);
    // Drop any shared-scenario hash so a stale link does not re-apply. The URL
    // sync effect would also clear it once state is default, but do it here too
    // so the intent is explicit.
    if (typeof window !== 'undefined') {
      const base = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, '', base);
    }
  };

  // The compare panel is objective-specific now, so changing the objective, the
  // budget, or a weight invalidates any shown comparison.
  const changeObjective = (next: Objective) => {
    setObjective(next);
    setComparison(null);
  };
  const changeBudgetPct = (pct: number) => {
    setBudgetPct(pct);
    setComparison(null);
  };
  const changeWeight = (id: string, value: number) => {
    setWeights((prev) => ({ ...prev, [id]: value }));
    setComparison(null);
  };

  const costFill = (id: number): string => {
    const cost = unitsById.get(id)?.cost ?? costRange.min;
    const span = costRange.max - costRange.min;
    const t = span > 0 ? (cost - costRange.min) / span : 0;
    return mix(COST_LO, COST_HI, t);
  };

  // A single-hue habitat surface for one species (the spotlight map).
  const habitatFill = (featureId: string) => {
    const max = featureMaxOf(units, featureId) || 1;
    return (id: number) =>
      mix(HAB_LO, HAB_HI, (unitsById.get(id)?.amounts[featureId] ?? 0) / max);
  };

  // The combined-habitat surface: every species' habitat summed, one scalar ramp.
  const combinedMax = useMemo(() => combinedHabitatMaxOf(units) || 1, [units]);
  const combinedFill = (id: number): string => {
    const unit = unitsById.get(id);
    return mix(HAB_LO, HAB_HI, unit ? combinedHabitatOf(unit) / combinedMax : 0);
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

  const irrepFill = (id: number): string =>
    mix(IRREP_LO, IRREP_HI, irrep?.frequency.get(id) ?? 0);

  const editCaption =
    brush.tool === 'cover'
      ? `Edit: paint ${coverName(brush.cover)}`
      : brush.tool === 'lockIn'
        ? 'Edit: lock in (click to toggle; always protected)'
        : brush.tool === 'lockOut'
          ? 'Edit: lock out (click to toggle; never selected)'
          : 'Edit: clear lock status';

  // The selected-priorities map is the shared result view, shown on both tabs.
  const priorityMap = (
    <GridView
      gridSize={SCENARIO.gridSize}
      caption="Selected priorities"
      fill={(id) => (selectedSet.has(id) ? SELECTED : UNSELECTED)}
      selected={selectedSet}
      border={statusBorder}
      onInspect={setInspected}
      inspectedId={inspected}
    />
  );

  const locksLegend = (
    <ul className="legend">
      {LEGEND.map((item) => (
        <li key={item.label}>
          <span
            className="legend-swatch"
            style={
              item.kind === 'fill'
                ? { background: item.color }
                : { border: `2px solid ${item.color}`, background: 'var(--surface)' }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );

  // Irreplaceability layer: a toggle, the heat map, and its scale legend. Shared
  // by both tabs' priority sections (only one renders at a time).
  const irrepToggle = (
    <label className="irrep-toggle">
      <input
        type="checkbox"
        checked={showIrrep}
        onChange={(e) => setShowIrrep(e.target.checked)}
      />
      Show irreplaceability
    </label>
  );

  const irrepMap = irrep && (
    <GridView
      gridSize={SCENARIO.gridSize}
      caption="Irreplaceability (how often selected)"
      fill={irrepFill}
      border={statusBorder}
      onInspect={setInspected}
      inspectedId={inspected}
    />
  );

  const irrepLegend = irrep && (
    <div className="irrep-scale">
      {irrep.runs === 0 ? (
        <p className="hint">
          No feasible plan for the current targets, so nothing to rank.
        </p>
      ) : (
        <>
          <span className="hint">Interchangeable</span>
          <span
            className="irrep-bar"
            style={{
              background: `linear-gradient(to right, ${mix(IRREP_LO, IRREP_HI, 0)}, ${mix(IRREP_LO, IRREP_HI, 1)})`,
            }}
          />
          <span className="hint">Irreplaceable</span>
        </>
      )}
    </div>
  );

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
            onClick={startOver}
            title="Clear every change and return to the default scenario"
          >
            Start over
          </button>
          <button
            type="button"
            className="tour-start secondary"
            onClick={copyLink}
            title="Copy a link to the current scenario"
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button type="button" className="tour-start" onClick={startTour}>
            Guided tour
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'explore'}
          className={view === 'explore' ? 'tab tab-on' : 'tab'}
          onClick={() => setView('explore')}
        >
          Explore
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'method'}
          className={view === 'method' ? 'tab tab-on' : 'tab'}
          onClick={() => setView('method')}
        >
          Method (advanced)
        </button>
      </div>

      <div className="layout">
        <div className="sidebar">
          {view === 'explore' && (
            <>
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
            </>
          )}

          {view === 'method' && (
            <section className="panel controls">
              <h2>Objective and weights</h2>
              <div className="tool-row">
                <button
                  type="button"
                  className={objective === 'min-set' ? 'tool tool-on' : 'tool'}
                  onClick={() => changeObjective('min-set')}
                >
                  Minimum set
                </button>
                <button
                  type="button"
                  className={objective === 'max-coverage' ? 'tool tool-on' : 'tool'}
                  onClick={() => changeObjective('max-coverage')}
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
                    onChange={(e) => changeBudgetPct(Number(e.target.value))}
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

              <label
                className={`control${tourHi('connectivity')}`}
                data-region="connectivity"
              >
                <span className="control-label">
                  Connectivity: {connectivityPenalty}
                </span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={connectivityPenalty}
                  onChange={(e) => setConnectivityPenalty(Number(e.target.value))}
                />
              </label>
              {connectivityPenalty > 0 && (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={sameCover}
                    onChange={(e) => setSameCover(e.target.checked)}
                  />
                  Link same cover (functional connectivity)
                </label>
              )}
              <p className="hint">
                Connectivity rewards plans whose areas are linked across short gaps, not
                only touching. Compactness is the special case of immediate adjacency.
                Turn on &ldquo;link same cover&rdquo; to reward connecting like habitat
                to like habitat.
              </p>

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
                      onChange={(e) => changeWeight(f.id, Number(e.target.value))}
                    />
                    <span className="weight-val">
                      {(weights[f.id] ?? 1).toFixed(1)}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}
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
            <table className="feature-table">
              <thead>
                <tr>
                  <th scope="col">Species</th>
                  <th scope="col">Represented</th>
                  <th scope="col">Progress to target</th>
                </tr>
              </thead>
              <tbody>
                {solution.attainment.map((a) => {
                  const pct = a.target > 0 ? Math.min(1, a.represented / a.target) : 1;
                  return (
                    <tr key={a.featureId}>
                      <th scope="row" className="feat-name">
                        <span
                          className="swatch"
                          style={{ background: featureColor(a.featureId) }}
                        />
                        {featureName(a.featureId)} {a.met ? '✓' : ''}
                      </th>
                      <td className="feat-num">
                        {Math.round(a.represented)} / {Math.round(a.target)}
                      </td>
                      <td className="feat-bar">
                        <span className="bar">
                          <span
                            className="bar-fill"
                            style={{
                              width: `${Math.round(pct * 100)}%`,
                              background: featureColor(a.featureId),
                            }}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

          {view === 'explore' && (
            <>
              <div className="editor-row">
                <div
                  className={`editor-map${tourHi('priority')}`}
                  data-region="priority"
                >
                  <div className="editor-map-head">
                    <h2>Priority areas</h2>
                    {irrepToggle}
                  </div>
                  <div className="maps">
                    {priorityMap}
                    <GridView
                      gridSize={SCENARIO.gridSize}
                      caption={editCaption}
                      fill={coverFill}
                      border={statusBorder}
                      onPaint={paint}
                      onInspect={setInspected}
                      inspectedId={inspected}
                    />
                    {irrepMap}
                  </div>
                  {irrepLegend}
                  {locksLegend}
                  <ul className="legend">
                    {COVERS.map((c) => (
                      <li key={c.id}>
                        <span
                          className="legend-swatch"
                          style={{ background: c.color }}
                        />
                        {c.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div
                className={`feature-section${tourHi('features')}`}
                data-region="features"
              >
                <h2>Derived from land cover</h2>
                <p className="hint">
                  Cost and habitat are computed from the cover you paint, not set
                  directly. Every habitat map uses one scale (darker = more), so the
                  display stays readable with many species. Pick a species to spotlight
                  its habitat.
                </p>
                <div className="maps">
                  <GridView
                    gridSize={SCENARIO.gridSize}
                    caption="Cost to protect (darker = pricier)"
                    fill={costFill}
                    onInspect={setInspected}
                    inspectedId={inspected}
                  />
                  <GridView
                    gridSize={SCENARIO.gridSize}
                    caption="Combined habitat (all species, darker = more)"
                    fill={combinedFill}
                    onInspect={setInspected}
                    inspectedId={inspected}
                  />
                  <div className="spotlight">
                    <label className="spotlight-select">
                      <span className="hint">View species habitat:</span>
                      <select
                        value={spotlight}
                        onChange={(e) => setSpotlight(e.target.value)}
                      >
                        {SCENARIO.features.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <GridView
                      gridSize={SCENARIO.gridSize}
                      caption={`${featureName(spotlight)} habitat (darker = more)`}
                      fill={habitatFill(spotlight)}
                      onInspect={setInspected}
                      inspectedId={inspected}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {view === 'method' && (
            <div className="editor-row">
              <div className="editor-map">
                <div className="editor-map-head">
                  <h2>Priority areas</h2>
                  {irrepToggle}
                </div>
                <div className="maps">
                  {priorityMap}
                  {irrepMap}
                </div>
                {irrepLegend}
                {locksLegend}
              </div>
              <div className={`curve-wrap${tourHi('curve')}`} data-region="curve">
                <CostTargetCurve
                  units={units}
                  fractions={fractions}
                  focusId={curveFocus}
                  focusName={featureName(curveFocus)}
                  color={featureColor(curveFocus)}
                />
                <p className="curve-explain">
                  As you ask to protect more of a species, the cheapest plan that meets
                  it costs more. The dot marks your current target.
                </p>
                <div className="curve-select">
                  <span className="hint">Cost curve for:</span>
                  {SCENARIO.features.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={f.id === curveFocus ? 'tool tool-on' : 'tool'}
                      onClick={() => setCurveFocus(f.id)}
                    >
                      {f.name.replace(/\s*\([^)]*\)$/, '')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === 'method' && (
            <div className={`panel compare${tourHi('compare')}`} data-region="compare">
              <div className="compare-head">
                <h2>Greedy vs near-optimal optimum</h2>
                <button
                  type="button"
                  className="tool"
                  onClick={runCompare}
                  disabled={comparing}
                >
                  {comparing ? 'Solving...' : 'Compute near-optimal optimum'}
                </button>
              </div>
              {(boundaryPenalty > 0 || connectivityPenalty > 0) && (
                <p className="hint">
                  The near-optimal optimum ignores the compactness and connectivity
                  penalties, which only steer the greedy heuristic.
                </p>
              )}
              {comparison === null ? (
                <p className="hint">
                  {objective === 'max-coverage'
                    ? 'Max coverage: the most target representation the budget can buy. Compares the greedy heuristic against a near-optimal optimum (within 1% of optimal).'
                    : 'Minimum set: the cheapest plan meeting every target. Compares the greedy heuristic against a near-optimal optimum (within 1% of optimal).'}
                </p>
              ) : comparison.kind === 'min-set' ? (
                comparison.exact.feasible ? (
                  <div className="compare-body">
                    <div className="stats">
                      <div className="stat">
                        <span className="stat-label">Greedy cost</span>
                        <span className="stat-value">{comparison.cmp.greedyCost}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Near-optimal cost</span>
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
                        caption="Both green; greedy-only amber; near-optimal-only blue"
                        fill={diffFill(comparison.cmp)}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="info">
                    The current targets are infeasible, so there is no near-optimal
                    optimum to compare.
                  </p>
                )
              ) : (
                <div className="compare-body">
                  <div className="stats">
                    <div className="stat">
                      <span className="stat-label">Greedy coverage</span>
                      <span className="stat-value">
                        {coveragePctLabel(
                          comparison.cmp.greedyCoverage,
                          comparison.cmp.maxCoverage,
                        )}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Near-optimal coverage</span>
                      <span className="stat-value">
                        {coveragePctLabel(
                          comparison.cmp.exactCoverage,
                          comparison.cmp.maxCoverage,
                        )}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Gap</span>
                      <span className="stat-value">
                        {comparison.cmp.gapPct.toFixed(1)} pts
                      </span>
                    </div>
                  </div>
                  <div className="maps">
                    <GridView
                      gridSize={SCENARIO.gridSize}
                      caption="Both green; greedy-only amber; near-optimal-only blue"
                      fill={diffFill(comparison.cmp)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {inspectedUnit && inspectedExplain && (
            <div
              className={`panel inspector${
                tourActive && currentStep?.inspect !== undefined
                  ? ' tour-highlight'
                  : ''
              }`}
            >
              <div className="inspector-head">
                <h2>
                  Cell ({inspectedUnit.row}, {inspectedUnit.col})
                  <span
                    className="swatch"
                    style={{ background: coverColor(inspectedUnit.cover) }}
                  />
                  {coverName(inspectedUnit.cover)}
                </h2>
                <button
                  type="button"
                  className="tool"
                  onClick={() => setInspected(null)}
                >
                  Close
                </button>
              </div>
              <p className="hint">
                Habitat quality here: {inspectedExplain.quality.toFixed(2)} (quality
                varies across the map, so cells of the same cover differ).
              </p>
              <table className="inspect-table">
                <tbody>
                  {inspectedExplain.species.map((s) => {
                    const raw =
                      Math.round(
                        s.suit * inspectedExplain.quality * SPECIES_PEAK * 10,
                      ) / 10;
                    return (
                      <tr key={s.id}>
                        <th>{featureName(s.id)}</th>
                        <td className="calc">
                          suit {s.suit.toFixed(2)} x quality{' '}
                          {inspectedExplain.quality.toFixed(2)} x {SPECIES_PEAK} ={' '}
                          {raw.toFixed(1)}
                          {s.amount === 0 && raw > 0 ? ' (below floor, so 0)' : ''}
                        </td>
                        <td className="calc-out">{s.amount.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <th>Cost</th>
                    <td className="calc">
                      base({coverName(inspectedUnit.cover)}){' '}
                      {inspectedExplain.cost.base} x (1 +{' '}
                      {inspectedExplain.cost.costVar.toFixed(2)})
                    </td>
                    <td className="calc-out">{inspectedExplain.cost.value}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {view === 'method' && (
            <div className="feature-section">
              <h2>The rules</h2>
              <p className="hint">
                How every cell&apos;s numbers are computed. Habitat = suitability x
                habitat quality x {SPECIES_PEAK}; cost is the cover base cost, nudged by
                local variation.
              </p>
              <div className="rules-wrap">
                <table className="rules">
                  <caption>Suitability (species x cover)</caption>
                  <thead>
                    <tr>
                      <th />
                      {COVERS.map((c) => (
                        <th key={c.id}>
                          <span className="swatch" style={{ background: c.color }} />
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SCENARIO.features.map((f) => (
                      <tr key={f.id}>
                        <th>{featureName(f.id)}</th>
                        {COVERS.map((c) => {
                          const v = SUITABILITY[f.id]?.[c.id] ?? 0;
                          return (
                            <td key={c.id} className={v === 0 ? 'zero' : undefined}>
                              {v.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr>
                      <th>Base cost</th>
                      {COVERS.map((c) => (
                        <td key={c.id}>{baseCostOf(c.id)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {currentStep !== null && tourStep !== null && (
        <TourPanel
          step={currentStep}
          index={tourStep}
          total={tourTotal}
          onBack={backStep}
          onNext={nextStep}
          onClose={() => goToStep(null)}
          {...(!fullTour && tourStep === SHORT_TOUR_LENGTH - 1
            ? { onContinueFull: continueFullTour }
            : {})}
        />
      )}
    </main>
  );
}
