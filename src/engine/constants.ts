// Engine constants for the prioritization model. Kept in a pure module so they
// are testable and reusable independent of React. See
// docs/design/01_prioritization_model.md.

// Default representation target: the fraction of each feature's total available
// amount that a solution must cover. Used as the starting target in the app.
export const DEFAULT_TARGET_FRACTION = 0.3;

// Size of the synthetic landscape (GRID_SIZE x GRID_SIZE planning units). The
// land-cover model uses a 30x30 landscape so the cover regions read as a real
// place. See docs/design/04_land_cover_model.md.
export const GRID_SIZE = 30;

// Tolerance for floating-point comparisons of amounts, costs, and scores.
export const EPS = 1e-9;
