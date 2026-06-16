---
name: pr-checkpoint
description: Run at the end of every stacked feature PR (and before any risky context compaction). Refreshes docs/agent/checkpoint.md and the local auto-memory so future PRs and future sessions keep the decisions, conventions, stack state, and mistakes-not-to-repeat they depend on.
---

# pr-checkpoint

Persist the context a future PR, or a future session after compaction, needs so nothing is re-derived and no mistake is repeated.

## When to run

- Immediately after opening a feature PR, before starting the next feature.
- Before a long delegation, or when the main thread is getting large.
- Whenever a decision, convention, or pitfall emerges that future work depends on.

## Steps

1. Read `docs/agent/checkpoint.md`.
2. Update **Stack state**: current branches, open PR numbers, issue numbers, and the single next action.
3. Add a dated entry under **PR log** for the PR just finished:
   - What shipped, in one or two lines.
   - Decisions worth remembering, with the ADR id if one was written.
   - New DB tables or migrations applied, new env vars, new seed data.
   - New reusable code future PRs should consume (helpers, components, types), with import paths.
4. Update **Pitfalls — do not repeat**: append any new mistake as `symptom -> rule`, imperative and concrete.
5. Update **Reusable inventory** if new shared building blocks were added.
6. Sync durable, cross-session facts to the local auto-memory at
   `C:\Users\azimm\.claude\projects\C--Users-azimm-OneDrive-Documents-github----sriaawp-portal\memory\`:
   a new recurring rule, convention, or workflow change becomes a memory file plus a one-line pointer in `MEMORY.md`. Do not duplicate what the checkpoint or repo already records; memory holds only what must survive across sessions.
7. Keep the checkpoint high-signal: it is a briefing for the next PR, not a transcript. Trim stale lines.
8. Commit the checkpoint update on the current branch: `docs(agent): checkpoint after <feature>`.

## Output

A one-paragraph confirmation: what was added to the checkpoint, any new pitfall, any memory written.
