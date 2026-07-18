# CLAUDE.md

Working rules and durable context for this project. This file is loaded into
context automatically, so keep it to direction and rules, not a task list.

## Project name

SCP_tutorial

## Project purpose

SCP_tutorial is an interactive web app that teaches the concepts of Systematic
Conservation Planning (SCP) to newcomers. A learner works with a small synthetic
landscape of planning units, sets representation targets for a few conservation
features, and watches a solver pick the lowest-cost set of units that meets those
targets. Changing targets, costs, or locked areas re-solves live, so the core
ideas (complementarity, the cost-versus-target tradeoff, irreplaceability) become
visible rather than abstract.

The app is one shared prioritization engine with three depth layers over it: the
core prioritization workflow (the MVP), a guided full-process journey, and an
advanced method deep-dive. See `docs/design/00_project_brief.md` for the full
brief.

## Project status

Design defined, pre-build. The repo harness, project brief, prioritization model
spec, milestones, and the stack and solver ADRs are in place. Next is M0
(scaffold) then M1 (the pure prioritization engine in `src/engine/`). Open GitHub
issues will be the live task tracker; `docs/design/03_milestones.md` is the shape
of the plan.

## Scope

An interactive, client-side teaching app for SCP concepts on synthetic data. It
is deliberately NOT: a production reserve-design tool, a replacement for
prioritizr or Marxan, a GIS application with real spatial data (at first), a
backend service, or a source of authoritative feature or cost data. The
prioritization math is kept faithful to the standard minimum-set formulation; the
data is simplified. Do not expand scope without a design note in `docs/design/`
or an ADR in `docs/decisions/`.

## Stack

- TypeScript (strict), React, Vite.
- Vitest for unit tests.
- Custom canvas/SVG grid rendering (no geographic map library for the abstract
  grid).
- The prioritization engine is pure, framework-free TypeScript under
  `src/engine/` so it is unit-testable independently of React.
- GitHub Pages for static deployment.

The solver is a greedy marginal-gain heuristic first, with an exact ILP solver
(glpk.js / WebAssembly) added later for small instances so learners can compare
greedy against optimal. The prioritization computation must stay out of React
components, in pure modules under `src/engine/`. Rationale and alternatives are
in the two ADRs dated 2026-07-18.

## Working rules

- Branch from `main`; one short-lived branch per change. Open a pull request
  into `main`; CI must pass before merge.
- Conventional Commits (for example `feat: ...`, `fix: ...`, `chore: ...`,
  `docs: ...`).
- No em dashes in code, comments, docs, commit messages, or user-facing text.
- Significant technical or design decisions get an ADR in `docs/decisions/`.
- Design notes live in `docs/design/`; session handoffs in `docs/handoffs/`.
- Keep changes small and focused; update docs when behaviour or design changes.
