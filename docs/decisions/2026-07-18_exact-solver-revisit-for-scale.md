# Exact solver: revisit for the 30x30 landscape

## Status

Proposed (pending benchmark)

## Context

The exact minimum-set optimum currently uses **javascript-lp-solver**, a pure-JS
mixed-integer programming solver (see the update section of
`2026-07-18_solver-greedy-first-ilp-later.md`). It was chosen because it runs in
the browser, in Node, and in the Vitest test environment, and it solves the MVP's
~100-variable instances instantly.

Moving to a 30x30 landscape (see the land-cover model ADR) raises the exact
instance to ~900 binaries. javascript-lp-solver is a naive branch-and-bound and is
already slow in testing; at 900 binaries it is expected to crawl or stall, and it
runs on the main thread, so it would freeze the UI.

An earlier attempt to use glpk.js (the original WebAssembly choice) was abandoned
because it "flooded a headless probe with its inlined worker source and did not
solve cleanly outside a browser," making it hard to unit-test in CI. So
**testability in the Vitest/CI environment is an explicit evaluation criterion**,
not just raw speed.

Options to evaluate:

1. **HiGHS compiled to WebAssembly (`highs-js`)**: a modern, fast MILP/LP solver.
2. **glpk.js (WebAssembly)**: the original choice; re-evaluate the CI-test issue.
3. **Keep javascript-lp-solver**: only viable if it proves fast enough at 900
   binaries after pruning locked-out / zero cells (unlikely).

Regardless of library, the exact solve should run in a **web worker** with a
**time limit / gap tolerance**, reporting "best found within Ns" so the UI never
freezes.

## Decision

Deferred pending a benchmark. Run each candidate on a representative 900-unit
minimum-set instance and measure solve time and, critically, whether it unit-tests
cleanly in Vitest/CI. Front-runner is HiGHS (`highs-js`) in a web worker with a
time limit; this ADR will be finalized (Status: Accepted) with the chosen library
once the benchmark results are in. If HiGHS is selected it supersedes the
javascript-lp-solver decision.

## Consequences

To be recorded with the final decision. Expected: a WebAssembly solver dependency
loaded lazily and off the main thread, a bound on instance size, and a time limit
so an unsolved-in-time case degrades to the best incumbent rather than hanging.
