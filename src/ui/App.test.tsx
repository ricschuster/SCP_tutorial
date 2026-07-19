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
  expect(container.textContent).toContain('Woodland Caribou');
  // At least the three per-feature target sliders are present.
  expect(
    container.querySelectorAll('input[type="range"]').length,
  ).toBeGreaterThanOrEqual(3);
  cleanup();
});

test('App solves and shows a priority map, cost, and attainment', async () => {
  const { container, cleanup } = await render();
  // The priority map renders as a labelled canvas.
  expect(
    container.querySelector('canvas[aria-label="Selected priorities"]'),
  ).not.toBeNull();
  expect(container.textContent).toContain('Total cost');
  expect(container.textContent).toContain('Areas selected');
  // The solver picked a non-empty set: the "Areas selected" stat reads "N / M"
  // with N > 0.
  const areas = [...container.querySelectorAll('.stat')].find((s) =>
    s.textContent?.includes('Areas selected'),
  );
  const selectedCount = Number(
    areas?.querySelector('.stat-value')?.textContent?.split('/')[0],
  );
  expect(selectedCount).toBeGreaterThan(0);
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
  const canvas = container.querySelector<HTMLCanvasElement>(
    'canvas.grid-canvas:not(.grid-canvas-editable)',
  );
  expect(canvas).not.toBeNull();
  // jsdom does no layout, so give the canvas a known on-screen box; a click near
  // its top-left then maps to cell (0, 0).
  canvas!.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 660,
    height: 660,
    right: 660,
    bottom: 660,
    x: 0,
    y: 0,
    toJSON() {},
  });
  await act(async () => {
    canvas!.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }),
    );
  });
  expect(container.textContent).toContain('Habitat quality here');
  cleanup();
});

test('App exposes an editable map and a reset control', async () => {
  const { container, cleanup } = await render();
  expect(container.querySelector('canvas.grid-canvas-editable')).not.toBeNull();
  const reset = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === 'Reset landscape',
  );
  expect(reset).toBeDefined();
  cleanup();
});

test('habitat maps are a combined layer plus a species spotlight selector', async () => {
  const { container, cleanup } = await render();
  // A single combined-habitat scalar map, plus a spotlight defaulting to the
  // first species; no per-species small multiples.
  expect(
    container.querySelector('canvas[aria-label^="Combined habitat"]'),
  ).not.toBeNull();
  expect(
    container.querySelector('canvas[aria-label^="Woodland Caribou (forest) habitat"]'),
  ).not.toBeNull();

  const select = container.querySelector(
    '.spotlight-select select',
  ) as HTMLSelectElement;
  expect(select).not.toBeNull();
  // Every feature is an option (8 species now).
  expect(select.querySelectorAll('option').length).toBeGreaterThanOrEqual(8);

  await act(async () => {
    select.value = 'waterbird';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(
    container.querySelector('canvas[aria-label^="Common Loon (waterbird) habitat"]'),
  ).not.toBeNull();
  expect(
    container.querySelector('canvas[aria-label^="Woodland Caribou (forest) habitat"]'),
  ).toBeNull();
  cleanup();
});

test('the feature table lists every species with an attainment bar', async () => {
  const { container, cleanup } = await render();
  const table = container.querySelector('table.feature-table');
  expect(table).not.toBeNull();
  const rows = table!.querySelectorAll('tbody tr');
  expect(rows.length).toBe(8);
  expect(table!.querySelectorAll('.bar-fill').length).toBe(8);
  cleanup();
});

// Set a controlled range input's value the way React expects (native setter,
// then an input event), so onChange fires.
function setRange(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

test('the connectivity control appears on Method and reveals the same-cover option', async () => {
  const { container, cleanup } = await render();
  const methodTab = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === 'Method (advanced)',
  );
  await act(async () => methodTab!.click());

  expect(container.textContent).toContain('Connectivity:');
  // The same-cover boost and the exact-ignores note are hidden until it is on.
  expect(container.textContent).not.toContain('Link same cover');

  const control = [...container.querySelectorAll('label.control')].find((l) =>
    l.textContent?.includes('Connectivity:'),
  );
  const slider = control!.querySelector('input[type="range"]') as HTMLInputElement;
  await act(async () => setRange(slider, '3'));

  expect(container.textContent).toContain('Link same cover');
  expect(container.textContent).toContain('ignores the');
  cleanup();
});
