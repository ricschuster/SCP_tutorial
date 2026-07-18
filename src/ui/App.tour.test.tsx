import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App.tsx';
import { TOUR_STEPS } from './tour.ts';

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === label,
  );
  if (!found) throw new Error(`button not found: ${label}`);
  return found;
}

test('the guided tour starts, advances, and finishes', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });

  // No tour panel until started.
  expect(container.querySelector('.tour-panel')).toBeNull();

  await act(async () => button(container, 'Guided tour').click());
  expect(container.querySelector('.tour-panel')).not.toBeNull();
  expect(container.textContent).toContain('Step 1 of ' + TOUR_STEPS.length);
  // A region is highlighted.
  expect(container.querySelector('.tour-highlight')).not.toBeNull();

  await act(async () => button(container, 'Next').click());
  expect(container.textContent).toContain('Step 2 of ' + TOUR_STEPS.length);

  // Jump to the last step and finish.
  for (let i = 2; i < TOUR_STEPS.length; i++) {
    await act(async () => button(container, 'Next').click());
  }
  expect(container.textContent).toContain('Step ' + TOUR_STEPS.length);
  await act(async () => button(container, 'Finish').click());
  expect(container.querySelector('.tour-panel')).toBeNull();

  await act(async () => root.unmount());
  container.remove();
});
