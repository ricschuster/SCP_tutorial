# Design note: canvas grid rendering

Status: accepted. Implements GitHub issue #21 (the rendering/interaction/perf
substrate). The many-feature scalar-layer redesign stays with #31; this note is
only the SVG-to-canvas migration.

## Why

The grid was drawn as an SVG of one `<rect>` per cell. At the 30x30 landscape the
Explore tab shows up to seven maps at once, so the DOM carried on the order of
6000 rect nodes, each re-created on every re-solve. That is what forced the
temporary `testTimeout: 20000` in `vite.config.ts` and is the wrong substrate for
any larger landscape. Canvas draws the same pixels with one DOM node per map.

## What changed

- `GridView` now renders a single `<canvas>` instead of an SVG of rects. Its
  props are unchanged, so `App` and every caller are untouched.
- Drawing is three passes: cell fills, then the light background grid as lines,
  then the emphasized outlines (inspected / lock status / selected) on top so a
  neighbour's fill never clips them. Precedence matches the old SVG exactly.
- The canvas buffer is sized to `devicePixelRatio` and scaled to a fixed CSS box,
  so cells stay crisp on high-DPI screens.
- Hit testing maps a pointer's client coordinates through the canvas box to a
  cell id; paint-on-drag and click-to-inspect behave as before.
- The global `testTimeout: 20000` (added for SVG render cost) is removed. Canvas
  fixes the rendering cost, but the irreplaceability Monte Carlo (dozens of
  greedy solves, added after that timeout) is heavy synchronous compute that only
  the two irreplaceability UI tests trigger, so those two tests carry an explicit
  longer per-test timeout instead of penalising the whole suite.

## Testability

jsdom does not implement a 2D context, so the drawing itself cannot be asserted in
the component tests. Two things keep coverage honest:

- The non-canvas decisions (hit testing, border precedence) live in a pure
  `src/ui/grid-draw.ts` and are unit-tested directly (`grid-draw.test.ts`).
- The component tests assert on the accessible surface (labelled canvases, the
  stat readouts, the inspector opening on a canvas click) rather than on rect
  fills. `test-setup.ts` stubs `getContext` to return null quietly, which the
  component already guards.
- The actual pixels are verified in a real browser (Playwright + the bundled
  Chromium): every map reads back as fully painted with the expected colour
  variety, a canvas click opens the inspector, and the console is clean.

## Measurements

Headline metric is DOM node count for the grids on the Explore tab at 30x30:

- Before (SVG): about 6300 `<rect>` nodes (7 maps x 900 cells), re-created on
  each re-solve.
- After (canvas): 7 `<canvas>` nodes; a re-solve repaints pixels, it does not
  churn the DOM.

Browser read-back after the migration (deviceScaleFactor 2, so a 660px logical
grid backs a 1320x1320 buffer): all seven canvases report every pixel painted
(1,742,400 each) with real colour variety (priority map 5 colours, cost 27,
habitat layers 135-246, irreplaceability heat 93), and no console errors.

## Limits / follow-ups

- Feature identity is still one hue per species (small multiples), fine for three
  species. The scalar many-feature display is #31.
- Canvas cells are not individually in the accessibility tree; each map keeps a
  descriptive `aria-label`. A per-cell a11y story (or an offscreen table) can come
  with the many-feature work if needed.
