# 03 Milestones

Phased plan. Each milestone should end with something runnable and, where there
is logic, tested. Open GitHub issues will be the live task tracker; this doc is
the shape of the plan. The guiding architecture is one shared prioritization
engine with three depth layers over it (see the project brief).

## M0: Scaffold

- Vite + React + TypeScript project, strict mode.
- Vitest for unit tests, one trivial passing test.
- ESLint + Prettier + typecheck wired into a CI workflow.
- GitHub Pages deploy workflow (build on push to `main`, publish `dist/`).
- Add the stack-specific harness files deferred earlier: `package.json`,
  `tsconfig.json`, Vite/ESLint/Prettier config, `.nvmrc`, CI and deploy
  workflows, and Dependabot.
- Repo structure per CLAUDE.md (`src/engine`, `src/data`, `src/ui`).

Done when: the empty app builds, deploys to Pages, and the test runner passes.

## M1: Prioritization engine (pure, headless)

- Types: planning unit (cost, status), feature (per-unit amount, target),
  problem, solution.
- Feasibility check with named shortfall features.
- Greedy marginal-gain minimum-set solver (deterministic tie-breaking).
- Target attainment and total cost computation.
- Locked-in and locked-out handling.
- Full unit test suite for the model doc's "testable units".

Done when: given a synthetic landscape and targets, the engine returns a correct
greedy selection, cost, and attainment, verified against hand-checked cases.

## M2: Core loop, visualized (Track 1 MVP)

- Render the planning-unit grid (custom canvas/SVG), the cost surface, and the
  per-feature amount layers.
- Target controls per feature and a Solve action.
- Priority map (selected units), total cost, and per-feature attainment readout.
- The starter example scenario authored as data.

Done when: a learner can set targets, solve, and see the priority map, cost, and
attainment on the example landscape.

## M3: Interaction and intuition

- A brush palette for editing the landscape on the map: paint feature amounts,
  paint cost, and lock-in / lock-out / clear a unit's status. Live re-solve.
- Reset landscape.
- A cost-versus-target curve (total cost as one feature's target is swept, with
  the other targets held), with a feature selector.

Done when: a learner can change targets, costs, feature amounts, and lock
constraints and watch the solution adapt, and can see the cost-versus-target
tradeoff.

Deferred to backlog: an explicit complementarity cue (why multi-feature units are
chosen); the current maps already make the effect visible.

## M4: Full SCP process (Track 2)

- A guided journey wrapping the core: set goals, assemble data, choose targets,
  prioritize, evaluate and implement (lock-in existing areas, lock-out no-go
  areas, sense-check the result).
- Short explanatory text at each stage.

Done when: a newcomer can walk the whole process end to end on the example and
understand where prioritization sits within it.

Delivered as a lightweight, data-driven stepper (narrate plus highlight an
existing region). The tour is a list of steps in `src/ui/tour.ts`; a richer
walkthrough (staged reveal, per-step presets, gating advance on an action) is a
later extension by adding optional fields to the step type, not a rewrite.

## M5: Method deep-dive (Track 3)

Split into two shippable halves.

### M5a: method knobs (greedy-side, no new dependency) [done]

- Advanced panel: minimum-set versus maximum-coverage under a budget, a
  boundary/compactness penalty (using grid adjacency), and feature weights.
- Engine: `solve` takes a backward-compatible options object.

Done when: a learner can switch objectives, set a budget, add a compactness
penalty, and weight features, and watch the greedy solution respond.

### M5b: exact ILP solver

- Exact ILP solver (glpk.js / WebAssembly) on small instances, presented next to
  greedy for a greedy-versus-optimal comparison.

Done when: a curious learner can compare the greedy solution against the exact
optimum on the example landscape.

## Later / backlog (post-MVP, each needs its own design + ADR)

- Irreplaceability / selection-frequency display.
- Connectivity beyond the boundary penalty.
- Real spatial / feature data ingestion (crosswalk, resampling to the grid).
- Scale the grid and feature count (performance pass; canvas rendering).
- Save / share a scenario (URL-encoded state).
