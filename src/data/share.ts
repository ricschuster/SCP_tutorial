// Save / share a scenario as a compact, URL-safe token.
//
// The full working state (edited unit cover and lock status, per-feature
// targets, and method options) is serialized so it can live in the page URL and
// be restored on load. Unit edits are stored as a diff against the base
// landscape, so an unedited scenario costs almost nothing to encode. Feature
// amounts and cost are derived from cover, so they are never stored.
//
// The token is versioned. Any token that fails to parse, targets an unknown
// version, or carries out-of-range values is rejected (decode returns null) so
// the app can fall back to the default scenario rather than crash on a stale or
// hand-edited link. This module is pure (no window access) so it is unit-tested
// independently of React; the app layer reads and writes the location hash.

import { DEFAULT_TARGET_FRACTION } from '../engine/constants.ts';
import type { Objective } from '../engine/greedy.ts';
import type { PlanningUnitStatus } from '../engine/types.ts';
import { isCoverId, type CoverId } from './land-cover.ts';
import {
  applyCover,
  makeWorkingUnits,
  SCENARIO,
  type WorkingUnit,
} from './scenario.ts';

// Current token schema version. Bump when the wire shape changes. v2 stores unit
// cover (v1 stored raw amounts/cost, which are now derived).
const SCHEMA_VERSION = 2;

// Valid ranges for the method knobs, mirrored from the UI controls. Values are
// clamped to these on decode so a tampered link cannot push the solver
// out of bounds.
const BUDGET_PCT = { min: 0, max: 100 } as const;
const BOUNDARY_PENALTY = { min: 0, max: 5 } as const;
const CONNECTIVITY_PENALTY = { min: 0, max: 5 } as const;
const WEIGHT = { min: 0, max: 3 } as const;
const DEFAULT_BUDGET_PCT = 50;
const DEFAULT_WEIGHT = 1;

export type AppView = 'explore' | 'method';

export interface ScenarioState {
  fractions: Record<string, number>;
  weights: Record<string, number>;
  objective: Objective;
  budgetPct: number;
  boundaryPenalty: number;
  connectivityPenalty: number;
  // Whether the connectivity matrix uses the same-cover (functional) boost.
  sameCover: boolean;
  view: AppView;
  units: WorkingUnit[];
}

// A single edited unit, relative to the base landscape. Only changed fields are
// present. `cv` is the repainted cover class; status is 'i' (locked-in) or 'o'
// (locked-out); 'available' is the default and is never stored.
interface WireUnit {
  i: number;
  cv?: CoverId;
  s?: 'i' | 'o';
}

interface Wire {
  v: number;
  f: Record<string, number>;
  w: Record<string, number>;
  o: 0 | 1;
  b: number;
  p: number;
  // Connectivity penalty; absent (older links) decodes to 0.
  cn?: number;
  // Same-cover connectivity boost on; absent means off.
  sc?: 1;
  // Active view: absent means 'explore' (the default), so a clean URL stays clean.
  vw?: 1;
  u: WireUnit[];
}

const FEATURE_IDS: readonly string[] = SCENARIO.features.map((f) => f.id);

// The clean starting state: default targets, unit weights, minimum-set, and an
// unedited landscape.
export function defaultState(): ScenarioState {
  const fractions: Record<string, number> = {};
  const weights: Record<string, number> = {};
  for (const id of FEATURE_IDS) {
    fractions[id] = DEFAULT_TARGET_FRACTION;
    weights[id] = DEFAULT_WEIGHT;
  }
  return {
    fractions,
    weights,
    objective: 'min-set',
    budgetPct: DEFAULT_BUDGET_PCT,
    boundaryPenalty: 0,
    connectivityPenalty: 0,
    sameCover: false,
    view: 'explore',
    units: makeWorkingUnits(),
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

// True if any unit has been edited away from the base landscape.
export function hasUnitEdits(units: readonly WorkingUnit[]): boolean {
  return units.some((u) => {
    const base = SCENARIO.units[u.id];
    if (base === undefined) return true;
    return u.cover !== base.cover || u.status !== 'available';
  });
}

// True if the state is the clean default (used to keep the URL tidy).
export function isDefaultState(state: ScenarioState): boolean {
  if (state.objective !== 'min-set') return false;
  if (state.budgetPct !== DEFAULT_BUDGET_PCT) return false;
  if (state.boundaryPenalty !== 0) return false;
  if (state.connectivityPenalty !== 0) return false;
  if (state.sameCover) return false;
  if (state.view !== 'explore') return false;
  for (const id of FEATURE_IDS) {
    if (state.fractions[id] !== DEFAULT_TARGET_FRACTION) return false;
    if (state.weights[id] !== DEFAULT_WEIGHT) return false;
  }
  return !hasUnitEdits(state.units);
}

const STATUS_CODE: Record<Exclude<PlanningUnitStatus, 'available'>, 'i' | 'o'> = {
  'locked-in': 'i',
  'locked-out': 'o',
};

function toWire(state: ScenarioState): Wire {
  const u: WireUnit[] = [];
  for (const unit of state.units) {
    const base = SCENARIO.units[unit.id];
    const diff: WireUnit = { i: unit.id };
    let changed = false;
    if (base === undefined || unit.cover !== base.cover) {
      diff.cv = unit.cover;
      changed = true;
    }
    if (unit.status !== 'available') {
      diff.s = STATUS_CODE[unit.status];
      changed = true;
    }
    if (changed) u.push(diff);
  }
  return {
    v: SCHEMA_VERSION,
    f: { ...state.fractions },
    w: { ...state.weights },
    o: state.objective === 'max-coverage' ? 1 : 0,
    b: state.budgetPct,
    p: state.boundaryPenalty,
    ...(state.connectivityPenalty !== 0 ? { cn: state.connectivityPenalty } : {}),
    ...(state.sameCover ? { sc: 1 as const } : {}),
    ...(state.view === 'method' ? { vw: 1 as const } : {}),
    u,
  };
}

// UTF-8-safe, URL-safe base64 (base64url, no padding).
function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): string {
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Serialize a state to a compact URL-safe token.
export function encodeState(state: ScenarioState): string {
  return toBase64Url(JSON.stringify(toWire(state)));
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function readFractionMap(
  raw: unknown,
  fallback: number,
  lo: number,
  hi: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  const src = isObject(raw) ? raw : {};
  for (const id of FEATURE_IDS) {
    const v = src[id];
    out[id] = typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
  }
  return out;
}

function readUnits(raw: unknown): WorkingUnit[] {
  const units = makeWorkingUnits();
  const indexById = new Map(units.map((u, i) => [u.id, i]));
  if (!Array.isArray(raw)) return units;
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const id = entry.i;
    if (typeof id !== 'number') continue;
    const index = indexById.get(id);
    if (index === undefined) continue;
    let unit = units[index]!;
    // Repaint cover (re-derives amounts and cost). Unknown covers are ignored.
    if (isCoverId(entry.cv)) unit = applyCover(unit, entry.cv);
    if (entry.s === 'i') unit.status = 'locked-in';
    else if (entry.s === 'o') unit.status = 'locked-out';
    units[index] = unit;
  }
  return units;
}

// Parse a token back into a state, or null if it is missing, malformed, or from
// an unknown schema version. The caller falls back to defaultState() on null.
export function decodeState(token: string | null | undefined): ScenarioState | null {
  if (!token) return null;
  let wire: unknown;
  try {
    wire = JSON.parse(fromBase64Url(token));
  } catch {
    return null;
  }
  if (!isObject(wire) || wire.v !== SCHEMA_VERSION) return null;
  return {
    fractions: readFractionMap(wire.f, DEFAULT_TARGET_FRACTION, 0, 1),
    weights: readFractionMap(wire.w, DEFAULT_WEIGHT, WEIGHT.min, WEIGHT.max),
    objective: wire.o === 1 ? 'max-coverage' : 'min-set',
    budgetPct:
      typeof wire.b === 'number' && Number.isFinite(wire.b)
        ? clamp(wire.b, BUDGET_PCT.min, BUDGET_PCT.max)
        : DEFAULT_BUDGET_PCT,
    boundaryPenalty:
      typeof wire.p === 'number' && Number.isFinite(wire.p)
        ? clamp(wire.p, BOUNDARY_PENALTY.min, BOUNDARY_PENALTY.max)
        : 0,
    connectivityPenalty:
      typeof wire.cn === 'number' && Number.isFinite(wire.cn)
        ? clamp(wire.cn, CONNECTIVITY_PENALTY.min, CONNECTIVITY_PENALTY.max)
        : 0,
    sameCover: wire.sc === 1,
    view: wire.vw === 1 ? 'method' : 'explore',
    units: readUnits(wire.u),
  };
}
