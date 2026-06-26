# Next-session orchestration prompt

The 2026-06-20 re-baseline drained into a GitHub backlog (issues labeled `re-baseline`). This is the prompt to hand the next Claude Code session to work that backlog autonomously. Paste the fenced block below as the first message of a fresh session.

Context it relies on: `CLAUDE.md` / `AGENTS.md` auto-load; the tickets are self-contained (each cites its ADR in `docs/phase-1/00-meta/decision-log.md` and lists scope + acceptance criteria + file pointers + dependencies); the re-baseline analysis lives in `docs/agent/checkpoint.md` (PR log 2026-06-21) and the ADRs.

Three decisions are already resolved (baked into the prompt) so the run does not stall:
1. **Facebook (#84/#85/#86)** — no real Meta account this phase; MOCK the Graph client behind an interface (env-selected), build the full outbound integration against the mock, gate the real adapter + App Review behind the env flag.
2. **Manual / AI mode 3 (#81/#88)** — the project PM (dev team) owns the authoritative manual; build the mode-3 pipeline against a placeholder manual now, structure ingestion so the PM's real manual is a content re-ingest, not a code change.
3. **Student commenting (#87)** — admin toggle (`allow_student_comments`) defaulting OFF.

---

```
Process the entire `re-baseline` backlog autonomously, end to end.

CONTEXT
- Repo conventions auto-load (CLAUDE.md, AGENTS.md). This is Next.js 16 - read the
  node_modules/next docs before writing code.
- The backlog = issues labeled `re-baseline` (gh issue list --label re-baseline).
  Each ticket is self-contained: it cites its ADR(s) in
  docs/phase-1/00-meta/decision-log.md and lists scope + acceptance criteria +
  file pointers + dependencies. Also read pr-stack.md, 00-master-plan.md, and
  docs/agent/checkpoint.md.

AUTONOMY CONTRACT
- You DECIDE all software/implementation details yourself - schema, wiring, library
  choices, file layout, UI, tests, and any "Proposed/recommended" option in a ticket
  (take the recommended one). Treat the Proposed ADRs as accepted for build. If
  implementation reveals a design flaw, write a new superseding ADR and continue.
- Record every non-trivial decision as an ADR or an issue comment (thesis audit trail).
- STOP and ask me ONLY for a genuinely NEW business/policy rule that no ADR or this
  prompt settles. Do not stop for software choices, and do not stop for the three
  items resolved below.

RESOLVED DECISIONS (apply these; they override any "parked/blocked" note in the tickets)
1. Facebook (#84, #85, #86): no real Meta account this phase - MOCK it. Put the Graph
   API behind a client interface with a mock implementation selected by env var; build
   the full outbound integration (fb_sync_link, outbox worker, public-only guard,
   dedup/idempotency, loop-prevention) against the mock - never call the real Graph
   API. The real adapter + App Review + the school's Page-admin grant are a
   production-turn-on step behind the env flag. Q16 (#86) credential ownership is
   deferred to turn-on, not a dev blocker.
2. Manual / AI mode 3 (#81, #88): the project's PM (dev team) owns and will author the
   authoritative manual - that content is pending, but do NOT block #81. Draft a minimal
   placeholder manual yourself (a how-to for the portal you're building), build the full
   mode-3 ingest + retrieval pipeline against it, and structure ingestion so swapping in
   the PM's real manual is a content re-ingest, not a code change. Flag the real content
   as pending the PM.
3. Student commenting (#87): implement an admin-configurable toggle (e.g.
   `allow_student_comments`) defaulting OFF - students cannot comment by default; an
   admin can toggle it on. Build it as part of the engagement work (#82/#83).

EXECUTION
1. Read the backlog + cited ADRs + pr-stack.md + master plan. Produce a
   dependency-ordered plan (spikes -> auth cut-over -> per-module features; honour
   spikes-before-build). Show me the plan, then proceed - don't wait unless the plan
   surfaces a NEW business rule.
2. Work one issue (or one tight cluster) per feature branch + PR, stacked per
   pr-stack.md (update pr-stack.md as you go). Per issue: read it + its ADRs, implement
   to its acceptance criteria, small focused commits, open the PR, comment/close the
   issue, checkpoint, next.
3. Keep the stack short: merge the bottom of the stack as you go (or keep <=4 deep, per
   pr-stack rule 6). EXCEPTION: leave #79 (the Auth.js -> Supabase cut-over) OPEN for my
   review before merge - it's the only ticket that rewrites already-shipped code
   (PR #25). Auto-merge the greenfield ones.
4. Never push to main. Continue until the backlog is drained or only genuine-business-
   rule items remain, then summarise what shipped, what's behind an env flag/mock, and
   what's pending the PM.

Start with the plan.
```

---

## Dependency order (the unblock chain)

```
Spikes first:  #11 Supabase Auth  ->  #13 pgvector/manual  ·  #14 AI SDK tool-calling  ·  #12 RLS
Then:          #79 auth cut-over (LEAVE OPEN for human review)  ->  unblocks #30-#34, #58
AI:            #14 -> #80 (modes 1+2);   #81 (mode 3) after the placeholder manual + #89 image storage
Engage:        #82 tables -> #83 UI (with the #87 toggle)
Facebook:      #84 spike (mock) -> #85 outbound (mock)
Frontend-gap:  #59-#70, #75 are independent; #58 waits on #79
```

The re-baseline ADRs (018-023) are `Proposed` pending supervisor/school sign-off. Sign-off gates production turn-on, not development - build ahead. The only true human stop is the **#79 PR review**.
