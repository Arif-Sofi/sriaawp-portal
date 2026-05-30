# Agent build workflow

This repository's feature build is run by an orchestrating Claude that delegates implementation to subagents. It exists so the main context stays lean, and so decisions, conventions, and mistakes survive across PRs and sessions.

## Why

A single context window cannot hold ten features' worth of implementation. The main thread is therefore a director: it decides and verifies, and hands the file-writing to short-lived subagents whose raw output never enters the main context.

## Roles

- **Orchestrator (main thread):** plan, per-feature specs, schema and RBAC decisions, ADRs, database migrations, verification, git, and PRs. Keeps its own context small and healthy.
- **Implementer subagents:** write code from a precise spec and return a short report. Disposable.
- **Reviewer subagents:** independently review each change set cold.

## Cadence

- The human e2e-tests once, on the cumulative top branch, after the whole train is built. Between features there is no human gate, so verification is fully automated: typecheck, lint, build, unit tests, and an independent review.
- One GitHub issue and one stacked PR per feature. Each branch stacks on the previous; the top branch is always the runnable demo.

## Context durability

- `docs/agent/checkpoint.md` is the living briefing: stack state, per-PR decisions, the reusable inventory, and a cumulative "do not repeat" pitfalls list. It is refreshed at the end of every PR by the `pr-checkpoint` skill.
- Cross-session facts (recurring rules, workflow changes) are mirrored into the local auto-memory so a fresh session restores them.

## Skills

- `stacked-feature-pr` — build one feature end to end with delegation.
- `pr-checkpoint` — persist context at the end of each feature.

Both live in `.claude/skills/`.
