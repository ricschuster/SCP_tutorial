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

// Toggling the layer on runs the irreplaceability Monte Carlo (dozens of greedy
// solves over 900 units) synchronously, which can exceed the 5s default on a
// slow CI runner, so these two tests get a longer explicit timeout.
const IRREP_TEST_TIMEOUT = 20000;

test(
  'irreplaceability layer is off by default and toggles on',
  async () => {
    const { container, cleanup } = await render();
    // Off by default: no heat map yet.
    expect(container.textContent).not.toContain(
      'Irreplaceability (how often selected)',
    );

    await act(async () => irrepCheckbox(container).click());

    // The heat map and its scale legend appear.
    expect(container.textContent).toContain('Irreplaceability (how often selected)');
    expect(container.textContent).toContain('Irreplaceable');
    expect(container.textContent).toContain('Interchangeable');
    cleanup();
  },
  IRREP_TEST_TIMEOUT,
);

test(
  'the irreplaceability heat map appears and toggles back off',
  async () => {
    const { container, cleanup } = await render();
    const caption = 'Irreplaceability (how often selected)';

    await act(async () => irrepCheckbox(container).click());
    expect(container.querySelector(`canvas[aria-label="${caption}"]`)).not.toBeNull();

    await act(async () => irrepCheckbox(container).click());
    expect(container.querySelector(`canvas[aria-label="${caption}"]`)).toBeNull();
    cleanup();
  },
  IRREP_TEST_TIMEOUT,
);
