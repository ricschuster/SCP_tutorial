import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

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
  // Some tests switch tabs or edit, which writes the scenario to the URL hash;
  // clear it so the next test hydrates from the default state, not a leftover.
  window.history.replaceState(null, '', window.location.pathname);
});

test('App renders the title and target controls', async () => {
  const { container, cleanup } = await render();
  expect(container.textContent).toContain('SCP Tutorial');
  expect(container.textContent).toContain('Forest species');
  // At least the three per-feature target sliders are present.
  expect(
    container.querySelectorAll('input[type="range"]').length,
  ).toBeGreaterThanOrEqual(3);
  cleanup();
});

test('App solves and shows a priority map, cost, and attainment', async () => {
  const { container, cleanup } = await render();
  const selected = container.querySelectorAll('rect[fill="rgb(27 120 55)"]');
  expect(selected.length).toBeGreaterThan(0);
  expect(container.textContent).toContain('Total cost');
  expect(container.textContent).toContain('Areas selected');
  cleanup();
});

test('tabs switch between Explore and Method content', async () => {
  const { container, cleanup } = await render();
  // Explore is the default: edit tools shown, advanced content hidden.
  expect(container.textContent).toContain('Edit tools');
  expect(container.textContent).not.toContain('Greedy vs exact optimum');

  const methodTab = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === 'Method (advanced)',
  );
  await act(async () => methodTab!.click());

  expect(container.textContent).toContain('Greedy vs exact optimum');
  expect(container.textContent).not.toContain('Edit tools');
  cleanup();
});

test('clicking a cell opens the mechanics inspector', async () => {
  const { container, cleanup } = await render();
  // The first non-editable grid is the priority map; its cells are inspectable.
  const rect = container.querySelector('svg.grid-svg:not(.grid-svg-editable) rect');
  expect(rect).not.toBeNull();
  await act(async () => {
    rect!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  });
  expect(container.textContent).toContain('Habitat quality here');
  cleanup();
});

test('App exposes an editable map and a reset control', async () => {
  const { container, cleanup } = await render();
  expect(container.querySelector('svg.grid-svg-editable')).not.toBeNull();
  const reset = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === 'Reset landscape',
  );
  expect(reset).toBeDefined();
  cleanup();
});
