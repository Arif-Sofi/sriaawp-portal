# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project context

`sriaawp-portal` is a UTM PSM1 final-year project (SECJH, Year 3): a school portal for SRIAAWP with public info, an admin/staff hub, parent dashboards, and a RAG chat surface. The repository is currently in **Phase 1 (FYP1, Waterfall)**: planning, requirements, and design are dominant; implementation lands in FYP2.

The application code under `src/app/` is intentionally a thin scaffold — the primary work product right now lives in `docs/phase-1/`.

## Key references

- `docs/phase-1/README.md` — read order for the FYP1 documentation hub.
- `docs/phase-1/00-master-plan.md` — mission, sequencing, definition-of-done.
- `docs/phase-1/00-meta/decision-log.md` — running ADR log. Every architectural decision lands here.
- `docs/phase-1/03-design/folder-structure-spec.md` — locked target tree for `src/` in FYP2 (referenced by ADR-001/004/012/013/014/015).
- `docs/phase-1/01-overview/p0-decisions-to-lock.md` — schema- and UI-blocking decisions; check status before assuming any are settled.

When proposing significant changes, check the ADR log first. If a decision needs to be made or revised, write a new ADR rather than silently changing direction.

## Commands

```bash
npm run dev            # Next.js dev server at http://localhost:3000
npm run build          # production build
npm run start          # serve production build

npm run lint           # ESLint (eslint-config-next + Prettier compat)
npm run typecheck      # tsc --noEmit
npm run format         # Prettier write
npm run format:check   # Prettier check (CI gate)

npm test               # Vitest run (jsdom, tests/**, src/**)
npm run test:watch     # Vitest watch
npm run test:coverage  # Vitest with coverage
npm run test:e2e       # Playwright (auto-starts dev server via webServer)
```

Run a single Vitest file: `npx vitest run tests/smoke.test.ts`.
Run a single Playwright spec: `npx playwright test e2e/smoke.spec.ts`.

CI (`.github/workflows/ci.yml`) runs lint → typecheck → format:check → unit tests on every PR. E2E tests are not in CI yet.

## Stack and architectural conventions

- **Next.js 16** App Router with **React 19** and the **React Compiler** enabled (`reactCompiler: true` in `next.config.ts`). Tailwind v4. TypeScript strict.
- **Critical**: Next.js 16 has breaking changes vs. older versions — see `AGENTS.md`. Notably, `middleware.ts` is renamed to `proxy.ts` (ADR-012). Do not add a `middleware.ts`.
- **Auth.js v5** beta for authentication; **Supabase** (Postgres + pgvector planned) for data; **Vercel AI SDK** + **`@ai-sdk/google`** (Gemini) for RAG.
- Path alias `@/*` → `./src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).
- Route groups in `src/app/` segregate role-scoped layouts: `(public)`, `(auth)`, `(parent)`, `(staff)`, `(admin)`. Role-named URL segments live inside each group (e.g. `(parent)/parent/dashboard`) — see `folder-structure-spec.md` for why.
- The folder-structure spec is the source of truth for where new code goes once FYP2 implementation begins. Do not invent new top-level directories under `src/` without updating that doc.

## Documentation conventions (docs/phase-1)

- No emojis. UTM-thesis-grade prose.
- Diagrams in Mermaid (kept inline so they cannot drift).
- File names: kebab-case lowercase. SQL DDL prose uses `.sql.md`.
- Citations: `[author, year]` inline; full entries in `docs/phase-1/00-meta/references.bib`.
- Every significant decision becomes an ADR in `docs/phase-1/00-meta/decision-log.md`.

## Workflow notes

- This is a stacked-PR workflow during Phase 1 — see `docs/phase-1/00-meta/pr-stack.md` before opening or rebasing branches.
- Secrets live in `.env.local` (git-ignored). `.env.example` lists every variable currently in use; keep it in sync when adding env vars.
