import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Tooltip } from './Tooltip.tsx';
import { HELP } from './help.ts';

async function render(node: React.ReactElement): Promise<{
  container: HTMLElement;
  cleanup: () => void;
}> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

test('Tooltip is a labelled button that hides its bubble until asked', async () => {
  const { container, cleanup } = await render(<Tooltip term="targets" />);
  const btn = container.querySelector('button.tooltip-btn')!;
  // Accessible name from the help label; no bubble and not expanded at rest.
  expect(btn.getAttribute('aria-label')).toBe('What is targets?');
  expect(btn.getAttribute('aria-expanded')).toBe('false');
  expect(container.querySelector('[role="tooltip"]')).toBeNull();
  cleanup();
});

test('Tooltip reveals its bubble on focus and hides on blur and Esc', async () => {
  const { container, cleanup } = await render(<Tooltip term="objective" />);
  const btn = container.querySelector<HTMLButtonElement>('button.tooltip-btn')!;

  await act(async () => btn.focus());
  const bubble = container.querySelector('[role="tooltip"]');
  expect(bubble).not.toBeNull();
  expect(bubble!.textContent).toBe(HELP.objective.text);
  // The bubble is wired to the button for assistive tech.
  expect(btn.getAttribute('aria-describedby')).toBe(bubble!.id);
  expect(btn.getAttribute('aria-expanded')).toBe('true');

  // Esc dismisses.
  await act(async () => {
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(container.querySelector('[role="tooltip"]')).toBeNull();

  // Focus again then blur also hides.
  await act(async () => btn.focus());
  expect(container.querySelector('[role="tooltip"]')).not.toBeNull();
  await act(async () => btn.blur());
  expect(container.querySelector('[role="tooltip"]')).toBeNull();
  cleanup();
});

test('Tooltip reveals its bubble on hover and hides on mouse leave', async () => {
  const { container, cleanup } = await render(<Tooltip term="curve" />);
  const wrap = container.querySelector('.tooltip')!;
  const btn = container.querySelector('button.tooltip-btn')!;

  // React synthesizes onMouseEnter/Leave from native mouseover/mouseout with a
  // relatedTarget outside the element.
  await act(async () =>
    btn.dispatchEvent(
      new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }),
    ),
  );
  expect(container.querySelector('[role="tooltip"]')).not.toBeNull();

  await act(async () =>
    wrap.dispatchEvent(
      new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }),
    ),
  );
  expect(container.querySelector('[role="tooltip"]')).toBeNull();
  cleanup();
});
