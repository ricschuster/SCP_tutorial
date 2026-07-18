# Stack: TypeScript + React + Vite

## Status

Accepted

## Context

SCP_tutorial is an interactive, client-side teaching app for newcomers to
Systematic Conservation Planning (see `docs/design/00_project_brief.md`). It
needs live, responsive re-solving in the browser, a custom grid visualization,
and a prioritization engine that can be unit-tested on its own. It has no backend
and deploys as a static site. It should parallel the sibling project
NCC-CNC/SHI_example, which is the pattern this repo's harness is based on, so the
two share conventions and are easy to maintain together.

## Decision

Build the app with:

- **TypeScript** in strict mode.
- **React** for the UI.
- **Vite** as the build tool and dev server.
- **Vitest** for unit tests.
- Custom **canvas / SVG** rendering for the abstract planning-unit grid (no
  geographic map library).
- **GitHub Pages** for static deployment.

The prioritization engine lives in pure, framework-free TypeScript under
`src/engine/`, separate from React, so it is testable independently. Repo layout:
`src/engine` (logic), `src/data` (typed content), `src/ui` (React).

## Consequences

Positive:

- Fast local dev and a small static deploy; no server to run or pay for.
- A pure, headless engine that is easy to unit-test and to reuse across the three
  UI depth layers.
- Consistency with SHI_example: shared conventions, harness, and CI/deploy shape.

Negative / trade-offs:

- No geographic map library means grid rendering and interaction are hand-built.
  Acceptable because the grid is abstract, and it keeps the bundle small.
- Client-only means heavier computation (the later exact ILP solver) must run in
  the browser (WebAssembly); it is bounded to small instances by design.
- Ties the project to the JavaScript/TypeScript toolchain rather than an
  R/Shiny-based tutorial; chosen for the live, browser-native interaction the
  teaching goal needs.
