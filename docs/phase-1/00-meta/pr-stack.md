# PR Stack

> Live tracker of the stacked-PR train against the `Arif-Sofi/sriaawp-portal` GitHub repository. The convention exists because each PR is reviewed independently but depends on the previous one's diff to make sense.
>
> **Convention.** Branches stack on the previous PR's branch, not on `main`. Merge in dependency order: bottom of the stack first, then each subsequent PR is rebased and force-pushed onto the new `main`. Commit hashes change across rebases — if you bookmark a hash, expect it to move.
>
> **Why.** Reviewer attention scales with diff size. A 3000-line PR is unreviewable; three 1000-line PRs are. Stacking keeps each diff focused on one workstream output.

---

## Current state (2026-05-05)

### PR #3 — `docs(phase-1): planning hub`

- **Branch.** `docs/phase-1-planning`
- **Base.** `main`
- **Status.** Open. Bottom of the stack.
- **Contains.** `docs/phase-1/` planning hub: master plan, P0 decisions sign-off doc, ADR-001..011, doc templates (FR / use case / NFR / ADR / spike / test case), folder index README, PP/PS transcriptions with page PNGs.
- **Depends on.** Nothing — branches from `main`.

### PR #22 — `feat(foundation): Next.js 16 + Tailwind v4 + React 19 compiler spikes + repo plumbing`

- **Branch.** `feat/foundation`
- **Base.** `docs/phase-1-planning` (branch off PR #3, **not** `main`)
- **Status.** Open. Middle of the stack.
- **Contains.** Foundation engineering work — Next.js 16 + Tailwind v4 + React 19 compiler, route groups (`(public)`, `(auth)`, `(parent)`, `(staff)`, `(admin)`), `.env.example`, Prettier + ESLint integration, Vitest unit + Playwright e2e plumbing, GitHub Actions CI, three spike reports (`spike-nextjs-16.md`, `spike-react-19-compiler.md`, `spike-tailwind-v4.md`).
- **Depends on.** PR #3 (the spike reports cite the master plan and the P0 decisions doc; would not make sense diffed against `main` alone).

### PR #23 — `docs(phase-1): WS-A meta + ADR-012..015 + folder-structure-spec`

- **Branch.** `docs/ws-a-meta`
- **Base.** `feat/foundation` (branch off PR #22, **not** `main`)
- **Status.** Open. Middle of the stack.
- **Contains.** WS-A meta files — glossary, risk register, stakeholder register, stakeholder communication plan, log book, revision history, references.bib, this PR-stack tracker. Plus four new ADRs (ADR-012..015) recording the Next.js 16 / React Compiler spike findings, and `docs/phase-1/03-design/folder-structure-spec.md` locking the target `src/` tree for FYP2.
- **Depends on.** PR #22 (the four new ADRs cite the Foundation spike reports; the folder-structure spec assumes the route-group scaffold from PR #22 exists).

### PR #24 — `feat(db): Drizzle schema for Auth.js + RBAC + profiles with RLS and synthetic seed`

- **Branch.** `feat/db-schema`
- **Base.** `docs/ws-a-meta` (branch off PR #23, **not** `main`)
- **Status.** Open. Top of the stack.
- **Contains.** Drizzle ORM + `@auth/drizzle-adapter` install; Drizzle schema files for the Auth.js v5 adapter tables, RBAC (roles, permissions, role_permission, user_role), profiles (parent / staff / student + family_link), departments, and parent verification request. Generated migration in `supabase/migrations/0000_auth_rbac_profiles.sql`. Hand-authored RLS policies in `supabase/migrations/0001_rls_policies.sql`. Synthetic seed (1 admin, 5 teachers, 20 parents, 30 students, 5 departments). RLS integration test (skipped without live DB). CI gains a `drizzle-kit check` step. New design docs (`database-schema.sql.md`, `rls-policy-design.md`) and ADR-016 (Drizzle choice).
- **Depends on.** PR #23 (cites ADR-012..015 in some doc cross-links and assumes the design folder layout from `folder-structure-spec.md`). Feature-domain tables (events, documents, embeddings, etc.) are explicitly **deferred** to subsequent PRs.

---

## Merge order

```
#3    docs/phase-1-planning   -> main          (merge first)
#22   feat/foundation         -> main          (rebase + merge after #3)
#23   docs/ws-a-meta          -> main          (rebase + merge after #22)
#24   feat/db-schema          -> main          (rebase + merge after #23)
```

After each merge, the next branch in the stack is rebased onto the new `main` and force-pushed. Commit hashes change across these rebases; the **content** is preserved, the **history** is rewritten. Reviewers are encouraged to re-fetch and use `gh pr diff` rather than relying on cached commit pages.

## Rules

1. **Never push to `main` directly.** Branch + PR only.
2. **Never re-base a stack member onto `main` until the predecessor has merged.** Otherwise the diff becomes "everything in the predecessor PR plus my own changes".
3. **A PR's title prefix names its workstream**: `docs(phase-1):`, `feat(foundation):`, `feat(rag):`, etc. Conventional-commits compatible.
4. **No emoji anywhere** — repo-wide convention from [`~/.claude/CLAUDE.md`](../../../CLAUDE.md).
5. **PR description** declares its position in the stack ("Stacked PR — review after #N, merge after #N") and lists merge order so a reviewer landing on this PR cold knows the dependency chain.
6. **Stop opening new stacks** when the active stack is 4 deep. Beyond that, reviewer fatigue dominates.

## Closed / merged PRs

(none yet)
