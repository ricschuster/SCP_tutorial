# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Initial project harness: issue and PR templates, contribution and security
  policies, docs structure (design, decisions, handoffs), and Claude Code
  working rules.
- GNU General Public License v3.0.
- Project definition: filled in the purpose, status, scope, and stack in
  CLAUDE.md and the README. Design docs (project brief, prioritization model
  spec, example scenario, milestones) and ADRs for the stack (TypeScript + React
  + Vite) and the solver (greedy heuristic first, exact ILP later).
- M0 scaffold: Vite + React + TypeScript app, Vitest with a coverage gate on the
  engine, ESLint + Prettier, CI running format/lint/typecheck/test/build, and a
  GitHub Pages deploy workflow. First engine module (constants) with tests.
- M1 prioritization engine (pure, headless): planning-unit / feature / problem /
  solution types, feasibility check with named shortfall features, greedy
  marginal-gain minimum-set solver with deterministic tie-breaking, target
  attainment and total-cost helpers, and locked-in / locked-out handling.
  Hand-checked Vitest suite (19 tests).
- M2 core loop, visualized (Track 1 MVP): the starter synthetic landscape (10x10
  grid, three clustered features, a cost surface rising toward a developed
  corner) authored as data; per-feature target sliders that re-solve live; and
  maps for the selected priorities, cost, and each feature's amounts, with a
  total-cost, areas-selected, and per-feature attainment readout.
- M3 interaction: a brush palette to edit the landscape on the map (paint feature
  amounts, paint cost, lock in / lock out / clear a unit) with live re-solve and
  a reset; locked units shown on the maps; and a cost-versus-target curve (total
  cost as one feature's target is swept, other targets held) with a feature
  selector.
- M4 guided tour (Track 2): a lightweight, data-driven stepper that walks the
  full planning process (goals, features, targets, prioritize, tradeoff,
  constraints) by narrating and highlighting the relevant panel at each step,
  reachable from a header button. Built to extend to a richer walkthrough later.
- M5a method knobs (Track 3, greedy-side): the engine `solve` now takes a
  backward-compatible options object supporting a maximum-coverage-under-budget
  objective, per-feature weights, and a boundary/compactness penalty (using grid
  adjacency), alongside the existing minimum-set objective. An advanced "Method"
  panel wires the objective, budget, compactness, and per-feature weights with
  live re-solve.
