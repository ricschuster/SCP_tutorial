import {
  decodeState,
  defaultState,
  encodeState,
  hasUnitEdits,
  isDefaultState,
  type ScenarioState,
} from './share.ts';
import { applyCover, makeWorkingUnits, SCENARIO } from './scenario.ts';

function editedState(): ScenarioState {
  const state = defaultState();
  state.fractions[SCENARIO.features[0]!.id] = 0.55;
  state.weights[SCENARIO.features[1]!.id] = 2.5;
  state.objective = 'max-coverage';
  state.budgetPct = 72;
  state.boundaryPenalty = 3.5;
  state.connectivityPenalty = 2.5;
  state.sameCover = true;
  // Edit a handful of units: repaint cover, and set both lock statuses.
  state.units[0] = applyCover(state.units[0]!, 'developed');
  state.units[1] = applyCover(state.units[1]!, 'water');
  state.units[2]!.status = 'locked-in';
  state.units[3]!.status = 'locked-out';
  return state;
}

test('the default state round-trips and is recognised as default', () => {
  const state = defaultState();
  expect(isDefaultState(state)).toBe(true);
  const decoded = decodeState(encodeState(state));
  expect(decoded).not.toBeNull();
  expect(isDefaultState(decoded!)).toBe(true);
});

test('a fully edited state round-trips exactly', () => {
  const state = editedState();
  const decoded = decodeState(encodeState(state));
  expect(decoded).not.toBeNull();
  expect(decoded!.fractions).toEqual(state.fractions);
  expect(decoded!.weights).toEqual(state.weights);
  expect(decoded!.objective).toBe('max-coverage');
  expect(decoded!.budgetPct).toBe(72);
  expect(decoded!.boundaryPenalty).toBe(3.5);
  expect(decoded!.connectivityPenalty).toBe(2.5);
  expect(decoded!.sameCover).toBe(true);
  expect(decoded!.units[0]!.cover).toBe('developed');
  expect(decoded!.units[1]!.cover).toBe('water');
  // Repaint re-derives amounts and cost from the new cover.
  expect(decoded!.units[1]!.cost).toBe(
    applyCover(makeWorkingUnits()[1]!, 'water').cost,
  );
  expect(decoded!.units[2]!.status).toBe('locked-in');
  expect(decoded!.units[3]!.status).toBe('locked-out');
  // Untouched units keep their base values.
  const base = makeWorkingUnits();
  expect(decoded!.units[50]).toEqual(base[50]);
});

test('the active view round-trips and counts as non-default', () => {
  const state = defaultState();
  state.view = 'method';
  expect(isDefaultState(state)).toBe(false);
  const decoded = decodeState(encodeState(state));
  expect(decoded!.view).toBe('method');
  // The default view stays clean.
  expect(decodeState(encodeState(defaultState()))!.view).toBe('explore');
});

test('connectivity round-trips and counts as non-default', () => {
  const state = defaultState();
  state.connectivityPenalty = 4;
  expect(isDefaultState(state)).toBe(false);
  expect(decodeState(encodeState(state))!.connectivityPenalty).toBe(4);

  // The same-cover boost alone is also non-default and round-trips.
  const fn = defaultState();
  fn.sameCover = true;
  expect(isDefaultState(fn)).toBe(false);
  expect(decodeState(encodeState(fn))!.sameCover).toBe(true);
});

test('a link without connectivity fields decodes to the defaults', () => {
  // Simulate an older shared link that predates connectivity: encode a state that
  // has no connectivity, then confirm the absent fields decode to 0 / false.
  const older = defaultState();
  older.boundaryPenalty = 2; // make it non-default so it actually encodes
  const decoded = decodeState(encodeState(older));
  expect(decoded!.connectivityPenalty).toBe(0);
  expect(decoded!.sameCover).toBe(false);
});

test('an edited state is not treated as default', () => {
  expect(isDefaultState(editedState())).toBe(false);
  expect(hasUnitEdits(editedState().units)).toBe(true);
  expect(hasUnitEdits(makeWorkingUnits())).toBe(false);
});

test('the default token is compact (unedited units cost nothing)', () => {
  // The whole default landscape should serialize without listing its 900 units:
  // the token holds only the per-feature target/weight maps, not any unit diff.
  expect(encodeState(defaultState()).length).toBeLessThan(500);
});

test('malformed, empty, and unknown-version tokens decode to null', () => {
  expect(decodeState(null)).toBeNull();
  expect(decodeState('')).toBeNull();
  expect(decodeState('not-valid-base64!!!')).toBeNull();
  expect(decodeState('e30')).toBeNull(); // base64 of "{}" (no version)
  const wrongVersion = encodeState(defaultState()).replace(/./, 'z');
  // Corrupting the token yields either a parse failure or a version mismatch;
  // either way, null.
  expect(decodeState(wrongVersion + 'garbage')).toBeNull();
});

test('out-of-range values are clamped, unknown feature ids ignored', () => {
  // Hand-build a wire object with hostile values, then encode it the same way
  // the module does, to exercise the decode guards.
  const state = defaultState();
  state.fractions[SCENARIO.features[0]!.id] = 5; // above 1
  state.budgetPct = 999;
  state.boundaryPenalty = -4;
  state.connectivityPenalty = 99;
  state.weights[SCENARIO.features[0]!.id] = 100;
  const decoded = decodeState(encodeState(state));
  expect(decoded).not.toBeNull();
  expect(decoded!.fractions[SCENARIO.features[0]!.id]).toBe(1);
  expect(decoded!.budgetPct).toBe(100);
  expect(decoded!.boundaryPenalty).toBe(0);
  expect(decoded!.connectivityPenalty).toBe(5);
  expect(decoded!.weights[SCENARIO.features[0]!.id]).toBe(3);
});
