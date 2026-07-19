# SCP_tutorial

An interactive web app that teaches Systematic Conservation Planning (SCP) to
newcomers: set representation targets for conservation features on a synthetic
landscape, solve for the lowest-cost set of priority areas, and see how the
solution responds to your choices.

## Status

Live and shipping. The first tagged release,
[v0.1.0-mvp](https://github.com/ricschuster/SCP_tutorial/releases/tag/v0.1.0-mvp),
covers the post-MVP teaching app: the core Explore loop, a Method deep-dive
(min-set and max-coverage objectives with an exact HiGHS solver), boundary and
connectivity penalties, irreplaceability, canvas rendering, a two-level guided
tour, and full-scenario URL sharing. 98 unit tests pass (engine coverage ~98%).
The next track is data ingestion (see issues #23 and #25).

Live app: https://ricschuster.github.io/SCP_tutorial/

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
- [Build-effort estimate](https://ricschuster.github.io/SCP_tutorial/effort-estimate.html):
  how long the app would take one person to build alone, by prior expertise
  (pinned to release v0.1.0-mvp).

## License

GNU General Public License v3.0. See `LICENSE`.
