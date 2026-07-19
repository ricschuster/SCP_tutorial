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
  window.history.replaceState(null, '', window.location.pathname);
});

function irrepCheckbox(container: HTMLElement): HTMLInputElement {
  const label = [...container.querySelectorAll('label.irrep-toggle')][0];
  return label!.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

test('irreplaceability layer is off by default and toggles on', async () => {
  const { container, cleanup } = await render();
  // Off by default: no heat map yet.
  expect(container.textContent).not.toContain('Irreplaceability (how often selected)');

  await act(async () => irrepCheckbox(container).click());

  // The heat map and its scale legend appear.
  expect(container.textContent).toContain('Irreplaceability (how often selected)');
  expect(container.textContent).toContain('Irreplaceable');
  expect(container.textContent).toContain('Interchangeable');
  cleanup();
});

test('irreplaceability heat marks at least one fully irreplaceable cell', async () => {
  const { container, cleanup } = await render();
  await act(async () => irrepCheckbox(container).click());

  // The heat fill ramps light-to-warm; a fully irreplaceable cell is the ramp's
  // hot end (rgb(179 0 0)). The default landscape has essential cells, so at
  // least one should reach it.
  const hot = container.querySelectorAll('rect[fill="rgb(179 0 0)"]');
  expect(hot.length).toBeGreaterThan(0);
  cleanup();
});
