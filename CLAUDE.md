# CLAUDE.md

Working rules and durable context for this project. This file is loaded into
context automatically, so keep it to direction and rules, not a task list.

## Project name

SCP_tutorial

## Project purpose

<!-- TODO: One or two paragraphs on what this project is and why it exists.
See docs/design/00_project_brief.md for the full brief. -->

TODO

## Project status

Early setup. The repo harness (design docs, decision records, handoffs,
issue/PR templates, and these working rules) is in place. The tech stack is not
yet chosen and the project scope is not yet defined. Decide the stack via an ADR
in `docs/decisions/`, then fill in the Stack section below.

## Scope

<!-- TODO: What this project is, and what it explicitly is not. -->

TODO. Do not expand scope without a design note in `docs/design/` or an ADR in
`docs/decisions/`.

## Stack

Not yet chosen. Record the decision as an ADR in `docs/decisions/` when made,
then fill in this section (language, framework, test runner, CI, deploy).

## Working rules

- Branch from `main`; one short-lived branch per change. Open a pull request
  into `main`; CI must pass before merge.
- Conventional Commits (for example `feat: ...`, `fix: ...`, `chore: ...`,
  `docs: ...`).
- No em dashes in code, comments, docs, commit messages, or user-facing text.
- Significant technical or design decisions get an ADR in `docs/decisions/`.
- Design notes live in `docs/design/`; session handoffs in `docs/handoffs/`.
- Keep changes small and focused; update docs when behaviour or design changes.
