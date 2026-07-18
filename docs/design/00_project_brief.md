# 00 Project Brief

## What this is

SCP_tutorial is an interactive web app for exploring the concepts behind
**Systematic Conservation Planning (SCP)**: the structured process of deciding
where to invest limited conservation resources so that a set of biodiversity
goals is met as efficiently as possible.

It is a teaching and exploration tool, not a production planning system. The goal
is to let a newcomer *see* how a prioritization works: put targets on a few
conservation features, pick which places to protect at least cost, and watch the
priority map and the numbers respond as targets, costs, and constraints change.

## Who it is for

- People new to conservation planning who want intuition for what "prioritize
  where to protect" actually means.
- Students, workshop attendees, and communicators who want a hands-on way to show
  complementarity, cost-efficiency, and the target-versus-cost tradeoff.

It assumes no coding and no prior SCP knowledge. Everything happens in the
browser.

## The core idea (one screen)

A grid of **planning units**. Each unit contains some amount of one or more
**conservation features** (for example, habitat for a few species) and has a
**cost** (what it takes to protect it). The learner sets a **target** for each
feature (for example, "represent 30% of species A"), presses **Solve**, and the
app selects the cheapest set of units that meets every target. Selected units
light up as the priority map; total cost and per-feature target attainment update
live. Change a target, edit a cost, lock a unit in or out, re-solve, and see the
effect immediately.

## The three layers (one engine)

All three of the scopes below are depth layers over a single shared
prioritization engine, not separate apps. This is what keeps the full vision
tractable.

1. **Core prioritization workflow (the MVP).** The loop above: features,
   targets, cost, solve, solution. Teaches complementarity, cost-efficiency, and
   the cost-versus-target tradeoff.
2. **Full SCP process.** A guided journey that wraps the core in the surrounding
   stages of a real planning exercise: set goals, assemble data, choose targets,
   prioritize (the core), then evaluate and implement (lock in existing protected
   areas, lock out no-go areas, read and sense-check the result).
3. **Method deep-dive.** An advanced panel that exposes the optimizer's knobs:
   minimum-set versus maximum-coverage under a budget, a compactness/boundary
   penalty, feature weights, and greedy-versus-exact solving.

## MVP scope

The MVP is Track 1, the core workflow, on a small synthetic landscape.

1. A small grid of planning units (start ~10x10).
2. A few conservation features (start three), each with a per-unit amount and a
   settable representation target.
3. A synthetic per-unit cost surface.
4. A greedy minimum-set solver that selects the priority units.
5. Live outputs: the priority map, total cost, and a per-feature target
   attainment readout.
6. Live re-solve when the learner changes a target, edits a cost, or locks a unit
   in or out.

See `docs/design/03_milestones.md` for the phased plan and
`docs/design/02_example_scenario.md` for the concrete starter example.

## Explicit non-goals (for now)

- A production reserve-design tool or a replacement for prioritizr or Marxan.
- Real spatial data or a GIS map (synthetic grid only at first).
- An exact ILP solver in the MVP (greedy first; exact comes later, see the solver
  ADR).
- A backend or database. The app is fully client-side and deploys as a static
  site.
- Authoritative feature, occurrence, or cost data. Example values are
  illustrative and tuned for teaching.

## Design principles

1. Faithful to the SCP concepts, simplified in the data. The math mirrors the
   standard minimum-set formulation; the landscape is synthetic.
2. One engine, layered depth. New capability is a layer over the shared engine,
   not a fork.
3. The engine is pure and headless. Prioritization logic lives in `src/engine/`,
   framework-free and unit-tested, independent of React.
4. Learn by doing. Every concept is something the learner can change and re-solve,
   not just read.

## Open questions

- Concrete starter landscape and feature theming (see the example scenario doc;
  values are illustrative).
- Where exactly the exact ILP solver lands in the plan (currently the method
  deep-dive milestone).
- How to present irreplaceability for a deterministic greedy solver (backlog).
