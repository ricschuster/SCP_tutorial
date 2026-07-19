// Vitest global setup.
//
// Enable React's act() environment so state updates flush synchronously in
// tests and React does not warn that the environment is unconfigured. The
// component smoke tests drive the real App through act(), which relies on this
// flag.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom does not implement scrollIntoView; the guided tour calls it on step
// change. Stub it so component tests can drive the tour.
Element.prototype.scrollIntoView = function scrollIntoView() {};

// jsdom does not implement the canvas 2D context (it logs "Not implemented" and
// returns null). GridView already guards a null context, so return null quietly
// here to keep the component-test output clean; the drawing itself is exercised
// in the browser, and the pure draw helpers are unit-tested directly.
HTMLCanvasElement.prototype.getContext = function getContext(): null {
  return null;
} as HTMLCanvasElement['getContext'];
