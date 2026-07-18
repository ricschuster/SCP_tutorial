import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_TARGET_FRACTION } from '../engine/constants.ts';
import { solve } from '../engine/index.ts';
import {
  costRangeOf,
  featureMaxOf,
  makeWorkingUnits,
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

  const solution = useMemo(
    () => solve(toProblemFromUnits(units, fractions)),
    [units, fractions],
  );
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

  const setFraction = (id: string, pct: number) =>
    setFractions((prev) => ({ ...prev, [id]: pct / 100 }));

  const paint = (id: number) => {
    setUnits((prev) => prev.map((u) => (u.id === id ? applyBrush(u, brush) : u)));
    setEdited(true);
  };

  const reset = () => {
    setUnits(makeWorkingUnits());
    setEdited(false);
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
            {!solution.feasible && (
              <p className="warn">
                Targets cannot be met (too much locked out or too little habitat):{' '}
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
