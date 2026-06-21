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
- **Status.** Open. Middle of the stack.
- **Contains.** Drizzle ORM + `@auth/drizzle-adapter` install; Drizzle schema files for the Auth.js v5 adapter tables, RBAC (roles, permissions, role_permission, user_role), profiles (parent / staff / student + family_link), departments, and parent verification request. Generated migration in `supabase/migrations/0000_auth_rbac_profiles.sql`. Hand-authored RLS policies in `supabase/migrations/0001_rls_policies.sql`. Synthetic seed (1 admin, 5 teachers, 20 parents, 30 students, 5 departments). RLS integration test (skipped without live DB). CI gains a `drizzle-kit check` step. New design docs (`database-schema.sql.md`, `rls-policy-design.md`) and ADR-016 (Drizzle choice).
- **Depends on.** PR #23 (cites ADR-012..015 in some doc cross-links and assumes the design folder layout from `folder-structure-spec.md`). Feature-domain tables (events, documents, embeddings, etc.) are explicitly **deferred** to subsequent PRs.

### PR #25 — `feat(auth): Auth.js v5 magic-link + Drizzle adapter + RBAC + per-role dashboards`

- **Branch.** `feat/auth-rbac`
- **Base.** `feat/db-schema` (branch off PR #24, **not** `main`)
- **Status.** Open. Top of the stack.
- **Contains.** Auth.js v5 (`next-auth@5.0.0-beta.30`) wired up with `@auth/drizzle-adapter` and the Postgres-flavour Drizzle client; database session strategy; magic-link delivery via Resend with a dev-mode `console.log` fallback; `proxy.ts` at the project root (Node runtime per ADR-012) for authenticated-vs-anonymous gating; bilingual `/login`, `/login/check-email`, `/login/error` pages following the UTM My Portal aesthetic; per-role dashboards using `requireUser` / `requirePermission`; RBAC server-side helpers and a session-context loader that joins roles/permissions/dept-ids/status; Vitest unit tests with a mocked Resend; CI env block adding `AUTH_SECRET` for production builds; ADR-017 (Resend + postgres.js + beta.30 pin); `auth-and-session-design.md`; spike playbook updated to `Status: Done` with implementation file paths and pitfalls encountered.
- **Depends on.** PR #24 (consumes the Auth.js adapter tables, the RBAC schema, and the seed catalogue; extends the catalogue with `staff:dashboard:read` and `admin:dashboard:read`). Reuses the design layout introduced in PR #23.

---

## Merge order

```
#3    docs/phase-1-planning   -> main          (merge first)
#22   feat/foundation         -> main          (rebase + merge after #3)
#23   docs/ws-a-meta          -> main          (rebase + merge after #22)
#24   feat/db-schema          -> main          (rebase + merge after #23)
#25   feat/auth-rbac          -> main          (rebase + merge after #24)
```

After each merge, the next branch in the stack is rebased onto the new `main` and force-pushed. Commit hashes change across these rebases; the **content** is preserved, the **history** is rewritten. Reviewers are encouraged to re-fetch and use `gh pr diff` rather than relying on cached commit pages.

## Rules

1. **Never push to `main` directly.** Branch + PR only.
2. **Never re-base a stack member onto `main` until the predecessor has merged.** Otherwise the diff becomes "everything in the predecessor PR plus my own changes".
3. **A PR's title prefix names its workstream**: `docs(phase-1):`, `feat(foundation):`, `feat(rag):`, etc. Conventional-commits compatible.
4. **No emoji anywhere** — repo-wide convention from [`~/.claude/CLAUDE.md`](../../../CLAUDE.md).
5. **PR description** declares its position in the stack ("Stacked PR — review after #N, merge after #N") and lists merge order so a reviewer landing on this PR cold knows the dependency chain.
6. **Stop opening new stacks** when the active stack is 4 deep. Beyond that, reviewer fatigue dominates.

## 2026-06-21 update — re-baseline docs branch

This tracker predates the FYP2 frontend train; the live stack tip is now well beyond PR #25. The 2026-06-20 re-baseline lands on its own branch `docs/rebaseline-2026-06`, **based on the current stack tip** (not `main`, which does not yet carry `docs/phase-1/`). It is docs-only (ADR-018..023, P0 v2, MoSCoW, Supabase-auth design, risk + source-doc reconciliation) and stacks above the source-docs sync. Title prefix: `docs(phase-1):`.

## 2026-06-21 — re-baseline BUILD train (draining the `re-baseline` backlog)

Stacks on the re-baseline docs branch `docs/rebaseline-2026-06` (PR #78). Nothing is merged to `main` yet; the whole foundation stack (#3..#78) is unmerged and awaiting the human's end-of-phase e2e. New build branches therefore stack on the tip and are left for that merge train rather than auto-merged. Stack runs deeper than the 4-deep rule by necessity (accepted tradeoff while `main` is empty). Keystone exception: **PR #79 (Auth.js -> Supabase cut-over) is left OPEN for human review** — it is the only ticket rewriting already-shipped code (PR #25).

Build train (bottom = earliest dependency):

| PR | Branch | Base | Issue | Status |
|----|--------|------|-------|--------|
| #90 | `spike/supabase-auth-ssr` | `docs/rebaseline-2026-06` | #11 | Open. Supabase Auth `@supabase/ssr` spike (additive; Auth.js stays live). |
| #91 | `spike/supabase-rls` | `spike/supabase-auth-ssr` | #12 | Open. Sample RLS policy + reusable cross-tenant block test helper. |
| #92 | `spike/ai-sdk-gemini` | `spike/supabase-rls` | #14 | Open. Vercel AI SDK + Gemini streaming + tool-calling + image-link envelope. |
| #93 | `spike/pgvector-gemini` | `spike/ai-sdk-gemini` | #13 | In progress. pgvector flat-scan over the manual + embedding pipeline + tau_refuse. |

Next planned (dependency order): #79 auth cut-over (LEAVE OPEN) -> #28/#26 DB -> #80/#81 AI -> #82/#83 engagement -> #84/#85 Facebook (mock) -> #58/#30-#34 auth follow-ups. See `docs/agent/next-session-prompt.md`.

## Closed / merged PRs

(none yet)
