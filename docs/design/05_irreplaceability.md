# Design note: irreplaceability / selection-frequency layer

Status: accepted. Implements GitHub issue #19.

## Why

Irreplaceability is named in the project purpose but is not yet visible. The maps
show a single greedy selection, which cannot convey how essential a unit is: a
learner sees one plan, not the space of good plans. This note picks a concrete,
teachable measure and records why.

## What a learner should see

Turn on a layer and read, per planning unit, how often it appears across a
portfolio of near-optimal plans, on a light-to-warm sequential scale:

- A unit selected in nearly every plan is irreplaceable (few or no substitutes).
- A unit selected in some plans but not others is interchangeable (swappable with
  an equally good alternative).

This makes complementarity and irreplaceability visible as a property of the
landscape rather than of one solution.

## Approach chosen: Monte Carlo over cost-perturbed greedy

The issue lists three options. We use perturbed greedy:

- The greedy min-set solver is deterministic, so one run gives no frequency
  signal. Run it `N` times, each time multiplying every available unit's cost by
  a small random factor `1 + jitter * u`, `u` uniform in `[-1, 1]`. Tally how
  often each unit is selected across the feasible runs; the frequency in `[0, 1]`
  is the irreplaceability score.
- Cost perturbation generates a portfolio of genuinely different near-optimal
  plans while keeping every plan feasible (targets and termination still use raw
  amounts, so a perturbed run is a valid min-set solution for the same targets).

Why this and not the alternatives:

- It reuses the engine's greedy solver, so it is fast enough to run live in the
  browser on the 30x30 grid and needs no new solver.
- It is faithful at both extremes. A feature present in only one unit forces that
  unit into every plan, giving frequency 1 (canonical irreplaceability). Two
  interchangeable units each win roughly half the runs, giving ~0.5 each.
- The exact-solver "portfolio of optima" option would need repeated MILP solves
  and enumeration of alternative optima, which is heavier and out of proportion
  for a teaching approximation. The formal feasible-set framing (Ferrier et al.)
  is explicitly out of scope for this issue.

### Determinism

The perturbation RNG is seeded (a small mulberry32 PRNG in the engine), matching
the project's no-runtime-randomness landscape generation. The same landscape,
targets, and options always produce the same heat, so the layer does not flicker
as unrelated state changes.

### Consistency with the current method

The Monte Carlo runs use the same `SolveOptions` (objective, weights, budget,
compactness) as the live solve, so the heat reflects the model the learner is
currently looking at, not a fixed one.

## Engine surface

`irreplaceability(problem, options?)` in `src/engine/irreplaceability.ts`, pure
and unit-tested, separate from rendering:

- `options`: `runs`, `jitter`, `seed`, `solveOptions`; all defaulted.
- returns `{ runs, frequency }` where `runs` is the number of feasible runs and
  `frequency` maps unit id to selection frequency in `[0, 1]`. Locked-in units
  are 1 by construction; locked-out are 0. When every run is infeasible, `runs`
  is 0 and all frequencies are 0.

## UI

A "Show irreplaceability" toggle adds a heat map beside the priority map on both
tabs, with a light-to-warm legend labelled interchangeable to irreplaceable. The
layer is computed on demand (only while the toggle is on) and is a transient
display preference, so it is not encoded in the share URL.

## Limits

- Approximate, not the formal statistical measure; enough to teach the idea.
- Cost perturbation is one perturbation mechanism; feature-order or tie-break
  perturbation could be added later if a scenario needs more solution diversity.
- Runs are bounded for responsiveness; the score is a sample estimate.
