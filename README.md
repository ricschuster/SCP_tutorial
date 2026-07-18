# SCP_tutorial

An interactive web app that teaches Systematic Conservation Planning (SCP) to
newcomers: set representation targets for conservation features on a synthetic
landscape, solve for the lowest-cost set of priority areas, and see how the
solution responds to your choices.

## Status

Design defined, pre-build. The repo harness and design docs (project brief,
prioritization model, milestones) and the stack and solver ADRs are in place.
Implementation starts with M0 (scaffold) and M1 (the prioritization engine).
See `docs/design/`.

## The idea

One shared prioritization engine with three depth layers over it:

1. Core prioritization workflow (the MVP): features, targets, cost, solve,
   solution.
2. Full SCP process: a guided journey wrapping the core, from goals to
   evaluation.
3. Method deep-dive: an advanced panel exposing the optimizer's knobs.

## Documentation

- `CLAUDE.md`: working rules and durable context for the project.
- `CONTRIBUTING.md`: how to contribute.
- `docs/design/`: the project brief, prioritization model, example scenario, and
  milestones.
- `docs/decisions/`: architecture decision records (ADRs).
- `docs/handoffs/`: session handoffs.

## License

GNU General Public License v3.0. See `LICENSE`.
