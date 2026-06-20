# SRIAAWP Portal

A school portal for SRIAAWP: public information, an admin/staff hub, parent dashboards, and a RAG chat surface. UTM PSM (final-year project), built on the Next.js App Router.

> This repository is in **Phase 1 (FYP1)** — planning, requirements, and design. The application under `src/app/` is a thin scaffold; the primary work product currently lives in [`docs/phase-1/`](docs/phase-1/README.md). Implementation lands in FYP2.

## Stack

- **Next.js 16** (App Router, React 19, React Compiler), TypeScript strict, Tailwind v4
- **Auth.js v5** (magic-link email) with the Drizzle adapter
- **Supabase** (Postgres + pgvector) accessed through **Drizzle ORM**
- **Vercel AI SDK** + **`@ai-sdk/google`** (Gemini) for the RAG chat
- **Resend** for magic-link delivery (optional in development)
- **Vitest** (unit) and **Playwright** (e2e)

Note: Next.js 16 has breaking changes from earlier versions — for example, `middleware.ts` is replaced by `proxy.ts`. See `AGENTS.md` and `CLAUDE.md` before writing code.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 LTS or newer | `npm` ships with it |
| Docker Desktop | latest | Must be installed and running — the Supabase CLI runs the local stack in Docker |
| Supabase CLI | pinned in `devDependencies` | Installed by `npm install`; invoke with `npx supabase` (a global `supabase` is not required) |

You do not need a hosted Supabase project for local development — the Supabase CLI runs the full stack (Postgres, Auth, Storage, Studio, mail catcher) in Docker. The CLI is pinned in `package.json`, so `npm install` provides it; run it as `npx supabase ...`.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in real values:

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored. The defaults in `.env.example` already point `DATABASE_URL` at the local Supabase Postgres (`127.0.0.1:54322`), so for a local-only setup you mostly need to generate secrets:

```bash
# AUTH_SECRET
npx auth secret

# IC_ENCRYPTION_KEY (32-byte base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Then set `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini) if you are working on the chat/embedding features. `AUTH_RESEND_KEY` can stay blank in development — `auth.ts` falls back to logging the magic link to the console (and the local mail catcher captures it too). See the comments in `.env.example` for what each variable does.

### 3. Start the local Supabase stack

```bash
npx supabase start
```

This boots Postgres and the rest of the stack in Docker. Default local endpoints:

| Service | URL |
|---------|-----|
| API | http://127.0.0.1:54321 |
| Postgres | postgres://postgres:postgres@127.0.0.1:54322/postgres |
| Studio (DB UI) | http://127.0.0.1:54323 |
| Inbucket (mail catcher) | http://127.0.0.1:54324 |

`npx supabase start` prints your local anon and service-role keys — copy them into `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

### 4. Apply the database schema

Migrations live in `supabase/migrations/`. Apply them to the local database:

```bash
npx supabase db reset
```

`db reset` recreates the local database and replays every migration from scratch — use it whenever you want a clean slate.

### 5. Seed synthetic data

```bash
npm run db:seed
```

This populates the database with a synthetic corpus (profiles, content, events, documents) via Faker. All seed data is synthetic — no real student data is used in development.

### 6. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

To sign in, request a magic link from the auth page. In development the link is printed to the dev-server console and also delivered to the Inbucket mail catcher at http://127.0.0.1:54324.

## Commands

```bash
npm run dev            # Next.js dev server (http://localhost:3000)
npm run build          # production build
npm run start          # serve the production build

npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run format         # Prettier write
npm run format:check   # Prettier check (CI gate)

npm test               # Vitest run
npm run test:watch     # Vitest watch
npm run test:coverage  # Vitest with coverage
npm run test:e2e       # Playwright (auto-starts the dev server)

npm run db:generate    # drizzle-kit generate (create migration SQL from schema changes)
npm run db:check        # drizzle-kit check (validate migrations)
npm run db:seed        # seed synthetic data
```

Run a single unit test: `npx vitest run tests/smoke.test.ts`.
Run a single e2e spec: `npx playwright test e2e/smoke.spec.ts`.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, format:check, and unit tests on every PR.

## Database workflow

Drizzle is the source of truth for the schema (`src/db/schema/`). To change the schema:

1. Edit the schema files under `src/db/schema/`.
2. Run `npm run db:generate` to emit a new SQL migration into `supabase/migrations/`.
3. Run `npx supabase db reset` (or `npx supabase migration up`) to apply it locally.
4. Reseed if needed with `npm run db:seed`.

## Project layout

```
src/
  app/            App Router routes, grouped by role:
    (public)/     public pages
    (auth)/       sign-in / magic-link flow
    (parent)/     parent dashboards
    (staff)/      staff hub
    (admin)/      admin hub
    actions/      server actions
    api/          route handlers
  components/     ui / shared / portal components
  db/             Drizzle schema, queries, seed
  lib/            domain logic (auth, rbac, content, documents, pdpa, i18n, ...)
  types/
proxy.ts          Next.js 16 proxy (replaces middleware.ts)
supabase/         local stack config + migrations
docs/phase-1/     FYP1 documentation hub (the current primary deliverable)
```

Route groups segregate role-scoped layouts. See `docs/phase-1/03-design/folder-structure-spec.md` for the locked target tree and the rationale.

## Documentation

- [`docs/phase-1/README.md`](docs/phase-1/README.md) — read order for the FYP1 documentation hub
- [`docs/phase-1/00-master-plan.md`](docs/phase-1/00-master-plan.md) — mission, sequencing, definition-of-done
- [`docs/phase-1/00-meta/decision-log.md`](docs/phase-1/00-meta/decision-log.md) — ADR log; every architectural decision lands here

## Troubleshooting

- **`supabase: command not found`** — the CLI is a project dev dependency, not global. Run `npm install`, then invoke it as `npx supabase ...`.
- **`npx supabase start` fails** — make sure Docker Desktop is installed and running (`docker info` should succeed).
- **App can't reach the database** — confirm `npx supabase start` is up and `DATABASE_URL` matches the local Postgres port (`54322`).
- **Magic link never arrives** — in development it is logged to the dev-server console and captured by Inbucket (http://127.0.0.1:54324); a real email is only sent when `AUTH_RESEND_KEY` is set.
- **Seed fails on a fresh DB** — run `npx supabase db reset` first so the schema exists, then `npm run db:seed`.
```
