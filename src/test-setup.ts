// Vitest global setup.
//
// Enable React's act() environment so state updates flush synchronously in
// tests and React does not warn that the environment is unconfigured. The
// component smoke tests drive the real App through act(), which relies on this
// flag.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
