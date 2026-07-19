import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { GridView } from './GridView.tsx';

// Mount an editable 10x10 grid over a known 300px box (each cell is 30px), so a
// client point maps to a predictable cell. jsdom does no layout, so the box is
// stubbed.
function mountEditable(onPaint: (id: number) => void): {
  canvas: HTMLCanvasElement;
  cleanup: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <GridView
        gridSize={10}
        caption="edit"
        fill={() => '#fff'}
        onPaint={onPaint}
        onInspect={() => {}}
      />,
    ),
  );
  const canvas = container.querySelector('canvas') as HTMLCanvasElement;
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 300,
    height: 300,
    right: 300,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON() {},
  });
  return {
    canvas,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function pointer(type: string, x: number, y: number, buttons = 0): MouseEvent {
  return new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, buttons });
}

test('dragging paints each crossed cell exactly once', () => {
  const painted: number[] = [];
  const { canvas, cleanup } = mountEditable((id) => painted.push(id));

  act(() => canvas.dispatchEvent(pointer('pointerdown', 5, 5, 1))); // cell 0
  act(() => canvas.dispatchEvent(pointer('pointermove', 8, 8, 1))); // same cell: no paint
  act(() => canvas.dispatchEvent(pointer('pointermove', 35, 5, 1))); // cell 1
  act(() => canvas.dispatchEvent(pointer('pointermove', 35, 35, 1))); // cell 11

  // One paint per cell entered (so a toggling lock tool fires once per cell).
  expect(painted).toEqual([0, 1, 11]);
  cleanup();
});

test('a move with no button pressed does not paint', () => {
  const painted: number[] = [];
  const { canvas, cleanup } = mountEditable((id) => painted.push(id));

  act(() => canvas.dispatchEvent(pointer('pointermove', 5, 5, 0)));
  act(() => canvas.dispatchEvent(pointer('pointermove', 65, 65, 0)));

  expect(painted).toEqual([]);
  cleanup();
});

test('releasing then re-entering the same cell paints it again', () => {
  const painted: number[] = [];
  const { canvas, cleanup } = mountEditable((id) => painted.push(id));

  act(() => canvas.dispatchEvent(pointer('pointerdown', 5, 5, 1))); // cell 0
  act(() => canvas.dispatchEvent(pointer('pointerup', 5, 5, 0)));
  act(() => canvas.dispatchEvent(pointer('pointerdown', 5, 5, 1))); // cell 0 again

  expect(painted).toEqual([0, 0]);
  cleanup();
});
