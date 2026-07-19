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

function openAbout(container: HTMLElement) {
  const about = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === 'About',
  );
  return about!;
}

test('About button opens an accessible dialog with scope and links', async () => {
  const { container, cleanup } = await render();
  expect(container.querySelector('[role="dialog"]')).toBeNull();

  await act(async () => openAbout(container).click());

  const dialog = container.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog!.getAttribute('aria-modal')).toBe('true');
  expect(dialog!.getAttribute('aria-labelledby')).toBe('about-title');
  // Names what it is, the honest scope, and the two reference links.
  expect(dialog!.textContent).toContain('Systematic');
  expect(dialog!.textContent).toContain('synthetic');
  expect(dialog!.textContent).toContain('prioritizr');
  const links = [...dialog!.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  expect(links).toContain('https://github.com/ricschuster/SCP_tutorial');
  expect(links).toContain('https://prioritizr.net');
  cleanup();
});

test('About closes via the Close button, Esc, and a backdrop click', async () => {
  const { container, cleanup } = await render();

  // Close button.
  await act(async () => openAbout(container).click());
  const close = [
    ...container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ].find((b) => b.textContent === 'Close');
  await act(async () => close!.click());
  expect(container.querySelector('[role="dialog"]')).toBeNull();

  // Esc.
  await act(async () => openAbout(container).click());
  const backdrop = container.querySelector('.modal-backdrop')!;
  await act(async () => {
    backdrop.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
  });
  expect(container.querySelector('[role="dialog"]')).toBeNull();

  // Backdrop click (but not a click inside the dialog).
  await act(async () => openAbout(container).click());
  await act(async () => {
    (container.querySelector('.modal-backdrop') as HTMLElement).click();
  });
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  cleanup();
});

test('clicking inside the About dialog does not close it', async () => {
  const { container, cleanup } = await render();
  await act(async () => openAbout(container).click());
  await act(async () => {
    (container.querySelector('.about-panel') as HTMLElement).click();
  });
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  cleanup();
});

test('the About guided-tour pointer starts the tour and closes the panel', async () => {
  const { container, cleanup } = await render();
  await act(async () => openAbout(container).click());
  const tourLink = container.querySelector('.link-button') as HTMLButtonElement;
  await act(async () => tourLink.click());
  // Panel gone, tour running (its step panel is a dialog labelled "Guided tour").
  expect(container.querySelector('.about-panel')).toBeNull();
  expect(container.querySelector('[aria-label="Guided tour"]')).not.toBeNull();
  cleanup();
});
