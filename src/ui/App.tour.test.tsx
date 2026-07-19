import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App.tsx';
import { SHORT_TOUR_LENGTH, TOUR_STEPS } from './tour.ts';

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === label,
  );
  if (!found) throw new Error(`button not found: ${label}`);
  return found;
}

function hasButton(container: HTMLElement, label: string): boolean {
  return [...container.querySelectorAll('button')].some(
    (b) => b.textContent?.trim() === label,
  );
}

async function mount(): Promise<{ container: HTMLElement; root: Root }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  return { container, root };
}

test('the short tour runs and offers to continue into the full tour', async () => {
  const { container, root } = await mount();

  // No tour panel until started.
  expect(container.querySelector('.tour-panel')).toBeNull();

  await act(async () => button(container, 'Guided tour').click());
  expect(container.querySelector('.tour-panel')).not.toBeNull();
  expect(container.textContent).toContain('Step 1 of ' + SHORT_TOUR_LENGTH);
  expect(container.querySelector('.tour-highlight')).not.toBeNull();

  // Advance to the last short step.
  for (let i = 1; i < SHORT_TOUR_LENGTH; i++) {
    await act(async () => button(container, 'Next').click());
  }
  expect(container.textContent).toContain(
    `Step ${SHORT_TOUR_LENGTH} of ${SHORT_TOUR_LENGTH}`,
  );
  // At the boundary there is no plain Next; the tour offers to continue.
  expect(hasButton(container, 'Next')).toBe(false);
  expect(hasButton(container, 'Continue full tour')).toBe(true);

  // Continue into the full tour: the scope grows to all steps. (Stepping through
  // the later Method steps drives the exact solver and the irreplaceability
  // Monte Carlo, which are verified in the browser, not here.)
  await act(async () => button(container, 'Continue full tour').click());
  expect(container.textContent).toContain(
    `Step ${SHORT_TOUR_LENGTH + 1} of ${TOUR_STEPS.length}`,
  );
  // A plain Next is back (no longer at the short boundary).
  expect(hasButton(container, 'Next')).toBe(true);

  await act(async () => button(container, 'Close').click());
  expect(container.querySelector('.tour-panel')).toBeNull();

  await act(async () => root.unmount());
  container.remove();
});

test('the short tour can finish without continuing, and restores state', async () => {
  const { container, root } = await mount();

  await act(async () => button(container, 'Guided tour').click());
  // The tour opens on the Explore tab; advance to the short-tour boundary.
  for (let i = 1; i < SHORT_TOUR_LENGTH; i++) {
    await act(async () => button(container, 'Next').click());
  }
  expect(hasButton(container, 'Finish')).toBe(true);

  await act(async () => button(container, 'Finish').click());
  expect(container.querySelector('.tour-panel')).toBeNull();
  // Closing restored the pre-tour view (no irreplaceability layer left on).
  expect(
    container.querySelector(
      'canvas[aria-label="Irreplaceability (how often selected)"]',
    ),
  ).toBeNull();

  await act(async () => root.unmount());
  container.remove();
});
