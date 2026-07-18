import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { defaultState, encodeState } from '../data/share.ts';
import { SCENARIO } from '../data/scenario.ts';

async function render(): Promise<{ container: HTMLElement; cleanup: () => void }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  // Do not let a hash leak between tests (each would otherwise hydrate from it).
  window.history.replaceState(null, '', window.location.pathname);
});

test('the app hydrates method options from a shared link', async () => {
  const state = defaultState();
  state.objective = 'max-coverage';
  state.budgetPct = 40;
  window.location.hash = encodeState(state);

  const { container, cleanup } = await render();

  const maxCoverage = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === 'Max coverage',
  );
  expect(maxCoverage?.className).toContain('tool-on');
  // The budget readout only appears under the max-coverage objective.
  expect(container.textContent).toContain('Budget used');
  cleanup();
});

test('the app hydrates a target from a shared link', async () => {
  const state = defaultState();
  state.fractions[SCENARIO.features[0]!.id] = 0.8;
  window.location.hash = encodeState(state);

  const { container, cleanup } = await render();

  expect(container.textContent).toContain(`${SCENARIO.features[0]!.name}: 80%`);
  cleanup();
});

test('a default app produces a clean URL (no hash)', async () => {
  const { cleanup } = await render();
  expect(window.location.hash).toBe('');
  cleanup();
});

test('the title row offers a copy-link control', async () => {
  const { container, cleanup } = await render();
  const copy = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === 'Copy link',
  );
  expect(copy).toBeDefined();
  cleanup();
});
