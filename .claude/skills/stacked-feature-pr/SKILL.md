---
name: stacked-feature-pr
description: Build one feature of the SRIAAWP stacked-PR train. The main thread orchestrates and delegates implementation to subagents to keep its context lean; verification is automated because the human only e2e-tests at the end. Use once per feature PR.
---

# stacked-feature-pr

Deliver one feature as an issue plus a stacked PR, with implementation delegated to subagents. The top branch of the train always carries the cumulative demo.

## Roles

- **Main thread (orchestrator):** owns decisions, specs, schema, RBAC, ADRs, verification, git, and context hygiene. Stays small.
- **Implementer subagents:** do the file-writing implementation from a precise spec. Their raw output never lands in the main thread; they return short reports.
- **Reviewer subagent:** independently reviews each change set cold.

## Loop

1. **Restore context.** Read `docs/agent/checkpoint.md` and the plan / task board.
2. **Design docs first.** If a controlling doc gates this feature (for example rbac-matrix before any RBAC surface), author or refresh it before code.
3. **Issue.** `gh issue create` with scope and an e2e acceptance checklist.
4. **Branch.** Stack off the current top branch: `git checkout -b <type>/<slug>`.
5. **Spec in the main thread.** Decide schema, routes, server actions (`ActionResult<T>`), RBAC gates, ADRs. Write it down; do not delegate the thinking.
6. **Delegate implementation.** Spawn a general-purpose subagent (sonnet for mechanical work) with a self-contained spec that references existing patterns and helpers. Forbid commit and push. Cap the report under ~200 words.
7. **Database.** Apply migrations to Supabase with the postgres.js `.simple()` runner pattern (see `scripts/`), extend the seed, verify with a count query. Synthetic data only (PDPA).
8. **Verify hard** (no human e2e until the very end): `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`. Then run the `code-reviewer` subagent on the change set and fix real findings. Re-verify.
9. **Format** only the new files; never a broad `src/**` glob or a parenthesised route-group glob.
10. **Commit** in small, focused conventional commits, staging explicit paths. Never `git add -A` (the tree carries untracked `scripts/` helpers and `.claude/` session data).
11. **PR.** Push, open the PR with `Closes #<issue>` and its stack position.
12. **Checkpoint.** Run the `pr-checkpoint` skill.
13. **Advance.** Mark the task done; move to the next feature.

## Pitfalls

Read `docs/agent/checkpoint.md` "Pitfalls — do not repeat" before each run, and add to it after.
