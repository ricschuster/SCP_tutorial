import { DEFAULT_TARGET_FRACTION, GRID_SIZE } from '../engine/index.ts';

export function App() {
  return (
    <main className="app">
      <h1>SCP Tutorial</h1>
      <p className="tagline">
        An interactive introduction to Systematic Conservation Planning: set targets for
        conservation features on a landscape, solve for the lowest-cost set of priority
        areas, and see how the solution responds.
      </p>
      <p className="scaffold-note">
        Scaffold (M0). The prioritization engine and interactive grid arrive in the
        milestones ahead. Defaults so far: a {GRID_SIZE}x{GRID_SIZE} grid and a{' '}
        {Math.round(DEFAULT_TARGET_FRACTION * 100)}% representation target.
      </p>
    </main>
  );
}
