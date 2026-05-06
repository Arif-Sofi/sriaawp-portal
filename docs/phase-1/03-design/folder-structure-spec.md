# Folder Structure Spec — `src/` for FYP2

> Target tree for the implementation phase (FYP2). Locks the conventions established by the Foundation spike (PR #22) and ADR-001 / ADR-004 / ADR-012 / ADR-013 / ADR-014 / ADR-015. A FYP2 contributor should be able to drop a new feature into the right folder without having to ask "where does this go?"
>
> **Scope.** This document specifies `src/` and its peers (`tests/`, `e2e/`, `proxy.ts`, `next.config.ts`, `drizzle/`). It does not specify `docs/` (covered by [Master plan §4](../00-master-plan.md)) or build/CI configuration (covered by `feat/foundation`).

---

## Overview

The application is a Next.js 16 App Router project with TypeScript, Tailwind v4, React 19 + React Compiler, Auth.js v5, and Supabase Postgres + pgvector. The `src/` tree is organised around three axes:

1. **Routing** lives under `src/app/` using parenthesised route groups for per-role layouts ([ADR-013](../00-meta/decision-log.md)).
2. **Domain logic** lives under `src/lib/` grouped by concern (auth, db, rbac, ai, utils). It is framework-agnostic and unit-testable in isolation.
3. **UI primitives** live under `src/components/ui/`; **feature components** live under `src/components/<feature>/`. Server-only and client-only files are explicitly marked.

Cross-cutting `proxy.ts` ([ADR-012](../00-meta/decision-log.md)) sits at the project root next to `next.config.ts`. Database migrations and generated types live under `src/db/`. Tests mirror `src/` under `tests/` (Vitest unit) and `e2e/` (Playwright user-journey specs).

---

## Target tree

```
sriaawp-portal/
  proxy.ts                              -- Next.js 16 proxy (ADR-012); session refresh, auth gating, request normalisation. Node.js runtime only.
  next.config.ts                        -- reactCompiler: true (ADR-015); cacheComponents NOT enabled (ADR-014).
  middleware.ts                         -- DO NOT add. Renamed to proxy.ts in Next.js 16; see ADR-012.
  drizzle.config.ts                     -- Drizzle Kit migration runner config (points at src/db/schema.ts).
  src/
    app/
      layout.tsx                        -- Root layout. Tailwind v4 globals.css imported here.
      globals.css                       -- @theme tokens (Tailwind v4 spike). Per-token comments only.
      favicon.ico
      not-found.tsx
      error.tsx                         -- Root error boundary; logs to audit_log.

      (public)/                         -- Anonymous + authenticated; no role gating in layout.
        layout.tsx                      -- Public chrome (top nav, language toggle, footer).
        page.tsx                        -- /     — landing.
        takwim/
          page.tsx                      -- /takwim — public events feed. First Cache Components opt-in target (ADR-014).
        news/
          page.tsx                      -- /news
          [slug]/page.tsx               -- /news/:slug
        privacy/
          page.tsx                      -- /privacy — PDP Notice (BM/EN toggle).

      (auth)/                           -- Login / signup / verify; redirects authenticated users away.
        layout.tsx
        login/page.tsx                  -- /login
        register/page.tsx               -- /register (parent self-register flow; PENDING_VERIFICATION per ADR-011)
        verify/page.tsx                 -- /verify — Admin-side approval flow

      (parent)/                         -- Parent role only; layout calls auth() and redirects on missing role.
        layout.tsx                      -- Parent chrome + role guard.
        parent/                         -- Role-named segment per ADR-013 (avoids URL collision with (staff)/staff/dashboard etc.)
          dashboard/page.tsx            -- /parent/dashboard
          children/
            page.tsx                    -- /parent/children
            [studentId]/page.tsx        -- /parent/children/:studentId — RBAC-checked at server action layer
          chat/page.tsx                 -- /parent/chat — RAG chat (ADR-009 grants Parent rag:query)

      (staff)/                          -- Teacher + non-admin staff; sub-roles distinguished inside server actions.
        layout.tsx
        staff/
          dashboard/page.tsx
          documents/page.tsx            -- /staff/documents — upload + list
          events/
            page.tsx
            new/page.tsx                -- /staff/events/new — conflict-modal flow
            [id]/page.tsx
          chat/page.tsx                 -- /staff/chat

      (admin)/                          -- Admin role only.
        layout.tsx
        admin/
          dashboard/page.tsx
          users/
            page.tsx
            [userId]/page.tsx
            verify/page.tsx             -- /admin/users/verify — pending parent approvals (ADR-011)
            link-family/page.tsx        -- /admin/users/link-family — manual + CSV bulk
          departments/page.tsx
          news/page.tsx
          memos/page.tsx
          events/page.tsx
          documents/page.tsx
          retrieval-log/page.tsx        -- Admin-only RAG audit view
          chat/page.tsx

      api/                              -- Route Handlers ONLY for streaming + public-cached (ADR-004).
        rag/ask/route.ts                -- POST — streaming RAG (ReadableStream + SSE).
        takwim/route.ts                 -- GET — public Takwim, edge-cached 60s.

      actions/                          -- Server Actions, organised per module (ADR-001 prefixes).
        users.ts                        -- FR-UM-* server actions.
        departments.ts                  -- FR-DM-*
        news.ts                         -- FR-IC-*
        memos.ts                        -- FR-IC-*
        events.ts                       -- FR-IC-* (conflict-checker entry point).
        cocurricular.ts                 -- FR-CR-*
        documents.ts                    -- ingest + RAG admin actions.

    lib/
      auth/
        index.ts                        -- auth() helper (Auth.js v5); session shape contract.
        session.ts                      -- DB session read/write (ADR-003).
        roles.ts                        -- role catalogue + sub-role inference.
      rbac/
        index.ts                        -- hasPermission(user, code) — single entry point (ADR-002).
        matrix.ts                       -- generated from rbac-matrix.md; do NOT hand-edit.
        scopes.ts                       -- scope qualifiers (Teacher.dept_id, Parent.family_link).
      db/
        client.ts                       -- Supabase server client (Node only).
        client-browser.ts               -- Supabase browser client (anon key, RLS-only).
        types.ts                        -- re-export from src/db/types.
      ai/
        provider.ts                     -- Vercel AI SDK Gemini provider (ADR-007).
        embed.ts                        -- gemini-embedding-001 wrapper (ADR-006); pins dim=1536.
        retrieve.ts                     -- pgvector + BM25 + RRF (ADR-005); ACL pre-filter.
        generate.ts                     -- streaming generation + citation post-processing.
        refusal.ts                      -- τ_refuse logic + BM/EN templates.
      conflict/
        index.ts                        -- detectConflicts(event) — see Master plan §11.6.
        rrule.ts                        -- RRULE expansion to event_occurrence rows.
        blackout.ts                     -- Hari Raya / Friday prayer / exam-week windows.
      pdpa/
        audit.ts                        -- audit_log writer; called from every student-data action (ADR-008).
        encrypt.ts                      -- IC number column encryption (AES-256, Supabase KMS).
        dsar.ts                         -- DSAR export + delete primitives.
      utils/
        result.ts                       -- ActionResult<T> standard shape (ADR-004).
        idempotency.ts                  -- Idempotency-key helpers (events.create, documents.upload).
        zod.ts                          -- shared Zod schemas + parse helpers.
        i18n.ts                         -- BM/EN string lookup.
      server-only.ts                    -- import 'server-only' barrel; lib/* that must never ship to the client re-exports through here.

    db/
      schema.ts                         -- Drizzle schema; canonical entity definitions.
      types.ts                          -- inferred Drizzle types (re-exported from lib/db/types.ts).
      seed.ts                           -- minimal dev seed (synthetic data only — ADR-007 / ADR-008).
      migrations/                       -- generated by Drizzle Kit; checked in.
        0001_initial.sql
        0002_pgvector.sql               -- create extension + vector(1536) column + HNSW index.
        ...
      rls/
        policies.sql                    -- RLS policies mirroring rbac-matrix.md (ADR-002).
        README.md                       -- regen instructions; never hand-edit.

    components/
      ui/                               -- Generic primitives. No domain knowledge. Tailwind tokens only.
        button.tsx
        card.tsx
        dialog.tsx
        toast.tsx
        form/
          field.tsx
          label.tsx
          error.tsx
        calendar.tsx
        date-time-range.tsx
        file-table.tsx
        chat-bubble.tsx
        citation-chip.tsx
        conflict-badge.tsx
        empty-state.tsx
        loading.tsx
      auth/
        login-form.tsx                  -- "use client"
        verify-pending-banner.tsx
      events/
        event-form.tsx                  -- "use client"
        conflict-modal.tsx              -- "use client" — see Master plan §11.7 Screen 2.
        recurrence-builder.tsx
      chat/
        chat-page.tsx                   -- "use client"
        message-list.tsx
        composer.tsx
        retrieval-debug-panel.tsx       -- admin-only.
        feedback-bar.tsx
        refusal-bubble.tsx
      documents/
        upload-zone.tsx
        ingest-status.tsx
      cocurricular/
        achievement-form.tsx
        approval-queue.tsx
      shared/
        nav.tsx
        language-toggle.tsx
        breadcrumbs.tsx

    types/
      env.d.ts                          -- runtime env contract (Zod-validated at boot).
      next.d.ts                         -- ambient types from `next typegen` (PageProps, RouteContext).

  tests/
    unit/                               -- Vitest. Mirrors src/lib structure.
      lib/
        auth/session.test.ts
        rbac/index.test.ts
        conflict/index.test.ts
        ai/refusal.test.ts
        utils/result.test.ts
      components/
        ui/button.test.tsx              -- @testing-library/react + jsdom.
    fixtures/
      synthetic-documents/              -- ADR-007: synthetic only; no real SRIAAWP content.
      golden-100.jsonl                  -- RAG eval golden Q&A (Master plan §11.5).

  e2e/                                  -- Playwright. One spec per critical user journey.
    public-takwim.spec.ts
    parent-register-and-verify.spec.ts
    teacher-upload-document.spec.ts
    teacher-create-event-conflict.spec.ts
    parent-rag-chat.spec.ts
    admin-link-family-csv.spec.ts
    fixtures/
      seed-test-db.ts                   -- runs against local Supabase via Docker.
```

---

## `proxy.ts`

Project root, Node.js runtime only ([ADR-012](../00-meta/decision-log.md)). Responsibilities:

- Refresh the Auth.js v5 DB session cookie on every authenticated request.
- Redirect anonymous users away from gated route groups (`(parent)`, `(staff)`, `(admin)`).
- Normalise trailing slashes and locale prefix (BM/EN).

Non-responsibilities: it does **not** enforce RBAC. RBAC checks live inside Server Actions and Route Handlers because Server Functions are reachable via direct `POST` ([Spike Next.js 16](../05-tech-spikes/spike-nextjs-16.md) pitfall 8 + [ADR-002](../00-meta/decision-log.md)).

The matcher excludes `api`, `_next/static`, `_next/image`, and `favicon.ico` — see [Spike Next.js 16](../05-tech-spikes/spike-nextjs-16.md) Code pattern 4.

---

## `src/lib/`

Framework-agnostic domain layer. Every function here is unit-testable without spinning up Next.js.

- **`lib/auth/`** — Auth.js v5 wiring. `auth()` is the single entry point used by `proxy.ts`, layouts, Server Actions, and Route Handlers. DB sessions per [ADR-003](../00-meta/decision-log.md).
- **`lib/rbac/`** — `hasPermission(user, code)` is the single source of truth for RBAC ([ADR-002](../00-meta/decision-log.md)). The permission catalogue (`matrix.ts`) is generated from `02-requirements/rbac-matrix.md` so the doc and the code cannot drift.
- **`lib/db/`** — Two Supabase clients: the server-side one uses the service-role key and skips RLS (RBAC enforced at the action layer); the browser-side one uses the anon key and is subject to RLS as defense-in-depth. Both speak Drizzle types from `src/db/`.
- **`lib/ai/`** — Vercel AI SDK + Gemini provider ([ADR-007](../00-meta/decision-log.md)). Embedding pinned to 1536-d ([ADR-006](../00-meta/decision-log.md)). Retrieval does ACL pre-filter (not post-filter) per [Master plan §11.5](../00-master-plan.md).
- **`lib/conflict/`** — `detectConflicts(event)` per [Master plan §11.6](../00-master-plan.md). Pure function over `event_occurrence` rows; no I/O outside the DB read.
- **`lib/pdpa/`** — Audit log writer, IC encryption, DSAR primitives ([ADR-008](../00-meta/decision-log.md)).
- **`lib/utils/`** — Cross-cutting helpers: `ActionResult<T>`, idempotency keys, Zod schema cache, BM/EN string lookup.
- **`lib/server-only.ts`** — Anything that imports the service-role key, file-system access, or `process.env.*_SECRET_*` re-exports through this barrel. Importing `lib/server-only.ts` from a `'use client'` file fails the build (Next.js's `server-only` package).

---

## `src/db/`

Drizzle ORM is the schema source of truth. Migrations are generated, hand-reviewed, and checked in.

- **`schema.ts`** — entity definitions matching `03-design/data-model-erd.md`.
- **`types.ts`** — inferred types; re-exported from `lib/db/types.ts` for consumer code.
- **`migrations/`** — checked-in SQL; `0002_pgvector.sql` creates the extension and the `vector(1536)` column ([ADR-005](../00-meta/decision-log.md), [ADR-006](../00-meta/decision-log.md)).
- **`rls/policies.sql`** — generated from `03-design/rls-policy-design.md`; never hand-edited. A periodic audit script (per [ADR-002](../00-meta/decision-log.md)) compares this file against the RBAC matrix and fails CI on drift.
- **`seed.ts`** — synthetic data only ([ADR-007](../00-meta/decision-log.md)); real SRIAAWP documents never enter the dev environment.

---

## `src/components/`

Two-layer split:

- **`components/ui/`** — generic primitives. No domain knowledge. Drives the design system from the Tailwind v4 `@theme` tokens defined in `app/globals.css` (per [`spike-tailwind-v4.md`](../05-tech-spikes/spike-tailwind-v4.md)).
- **`components/<feature>/`** — feature-bound components (events, chat, documents, cocurricular, auth, shared chrome). Heavy use of Server Components by default; client islands marked with `'use client'` at the top of the file.

The React Compiler ([ADR-015](../00-meta/decision-log.md)) handles auto-memoisation in client islands. Do **not** add `useMemo` / `useCallback` pre-emptively. If a render hotspot is profiled and the compiler missed it, add manual memoisation deliberately.

---

## `tests/` and `e2e/`

- **`tests/unit/`** uses Vitest with jsdom ([Foundation PR #22](../00-meta/pr-stack.md) plumbing). Structure mirrors `src/lib/` and `src/components/`. Test names follow `Test_<Function>_<Scenario>`.
- **`tests/fixtures/`** — synthetic test data. The `golden-100.jsonl` file is the RAG evaluation golden set ([Master plan §11.5](../00-master-plan.md)).
- **`e2e/`** uses Playwright. One spec per critical user journey listed in [Master plan §5 WS-C](../00-master-plan.md) (5 sequence diagrams). Specs run against a local Supabase via Docker; `e2e/fixtures/seed-test-db.ts` is the entry point for setup.

---

## Conventions

### File naming

- Routes: `kebab-case` directories; `page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx`, `loading.tsx` use Next.js' reserved names verbatim.
- Library files: `kebab-case.ts` for modules, `PascalCase.tsx` for React components.
- Tests: mirror the source path with a `.test.ts(x)` suffix.

### Server-only / client-only markers

- Server Components are the default. No marker needed.
- Server Actions: `"use server"` at the top of the action file (e.g. `app/actions/events.ts`). Auth + RBAC checks happen **inside** every action, not in `proxy.ts` ([Spike Next.js 16](../05-tech-spikes/spike-nextjs-16.md) pitfall 8).
- Client islands: `"use client"` at the top of the component file. Used for `ConflictModal`, `Composer`, `EventForm`, `LoginForm`, `FileTable`, `ChatPage`.
- Modules that must never leak to the client side: import the `server-only` package or re-export through `src/lib/server-only.ts`.

### Barrel exports

- Per-feature `index.ts` is allowed for `components/<feature>/` to keep imports short.
- `src/lib/` does **not** use a top-level barrel — direct imports like `import { hasPermission } from "@/lib/rbac"` are clearer than `import { hasPermission } from "@/lib"`.

### Imports

- Use the `@/` path alias configured in `tsconfig.json` for everything in `src/`.
- Relative imports only for sibling files (`./<sibling>`); never `../../`.

### `next.config.ts`

- `reactCompiler: true` ([ADR-015](../00-meta/decision-log.md)).
- `cacheComponents` is **not** enabled ([ADR-014](../00-meta/decision-log.md)). Routes opt in selectively via the `'use cache'` directive once their data shape is finalised; the first opt-in target is `(public)/takwim`.
- Use `skipProxyUrlNormalize` (not `skipMiddlewareUrlNormalize`) when normalisation behaviour needs tweaking ([ADR-012](../00-meta/decision-log.md)).

### Parallel routes

- `wireframes/conflict-modal.md` and `wireframes/citation-drawer.md` are candidates for parallel routes (`@modal/...`). Per [Spike Next.js 16](../05-tech-spikes/spike-nextjs-16.md) pitfall 9, every parallel slot must have a `default.js` or the build fails. Add it at the same time as the slot.

---

## References

- [`../00-master-plan.md`](../00-master-plan.md) §4 (target Phase-1 doc tree), §11.5 (RAG pipeline), §11.6 (conflict detection).
- [`../05-tech-spikes/spike-nextjs-16.md`](../05-tech-spikes/spike-nextjs-16.md) — pitfalls 1, 2, 5, 8, 9.
- [`../05-tech-spikes/spike-react-19-compiler.md`](../05-tech-spikes/spike-react-19-compiler.md).
- [`../05-tech-spikes/spike-tailwind-v4.md`](../05-tech-spikes/spike-tailwind-v4.md) — Tailwind v4 `@theme` tokens drive `components/ui/`.
- [ADR-001](../00-meta/decision-log.md) — module decomposition (UM/DM/IC/CR/AI prefixes).
- [ADR-002](../00-meta/decision-log.md) — RBAC source of truth = application layer.
- [ADR-003](../00-meta/decision-log.md) — DB sessions, not JWT.
- [ADR-004](../00-meta/decision-log.md) — Server Actions for mutations + Route Handlers for streaming/public-cached.
- [ADR-005](../00-meta/decision-log.md) — pgvector inside Supabase.
- [ADR-006](../00-meta/decision-log.md) — Gemini Embedding 1536-d.
- [ADR-007](../00-meta/decision-log.md) — Gemini 2.5 Flash; synthetic-only dev data.
- [ADR-008](../00-meta/decision-log.md) — PDPA-aligned design.
- [ADR-012](../00-meta/decision-log.md) — `proxy.ts` not `middleware.ts`.
- [ADR-013](../00-meta/decision-log.md) — role-named segment inside route groups.
- [ADR-014](../00-meta/decision-log.md) — Cache Components opt-in.
- [ADR-015](../00-meta/decision-log.md) — React Compiler stays enabled.
- `auth-and-session-design.md` (placeholder; authored later in WS-C) — source of truth for the session shape and `proxy.ts` body.
