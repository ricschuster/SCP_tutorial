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

test('App renders the title and target controls', async () => {
  const { container, cleanup } = await render();
  expect(container.textContent).toContain('SCP Tutorial');
  expect(container.textContent).toContain('Forest species');
  expect(container.querySelectorAll('input[type="range"]').length).toBe(3);
  cleanup();
});

test('App solves and shows a priority map, cost, and attainment', async () => {
  const { container, cleanup } = await render();
  // The solver selected some units: priority cells are filled with the accent.
  const selected = container.querySelectorAll('rect[fill="rgb(27 120 55)"]');
  expect(selected.length).toBeGreaterThan(0);
  // The stats and attainment readouts are present.
  expect(container.textContent).toContain('Total cost');
  expect(container.textContent).toContain('Areas selected');
  cleanup();
});
