# Build checkpoint

Living briefing for the SRIAAWP feature build. Refreshed at the end of every PR by the `pr-checkpoint` skill. Read this first when starting a PR or resuming after a context reset.

## Stack state (latest first)

- Train base: `feat/auth-rbac` (PR #29, under review), on `feat/db-schema` (#24), on `docs/ws-a-meta` (#23).
- `feat/design-system` — PR #37, closes #36. PR1 DONE.
- `chore/agent-workflow` — this agent tooling (skills, workflow doc, checkpoint). Branched off `feat/design-system`.
- NEXT: PR2 `feat/public-shell` (public homepage + app shell + working BM/EN toggle), branched off `chore/agent-workflow`.
- Full plan: 10 feature PRs — design-system, public-shell, news, takwim, events+conflict, parent, admin-users, staff, documents, rag-chat. Task board tracks them.

## Demo environment

- Hosted Supabase project ref `efpyhlfpyxfauvaynrfw` (PostgreSQL 17). `.env.local` `DATABASE_URL` uses the direct connection (`db.<ref>.supabase.co:5432`); reachable from this machine (IPv6 OK).
- Migrations `0000_auth_rbac_profiles.sql` and `0001_rls_policies.sql` applied. Seed loaded: 56 users (1 admin, 5 teachers, 20 parents, 30 students), 4 roles, 29 permissions, 5 departments.
- Login is magic-link; with `AUTH_RESEND_KEY` blank the link prints to the dev-server console. Seed accounts: `test-admin@sriaawp.test`, `teacher.1@sriaawp.test`, `parent.1@sriaawp.test`.
- Dev server: `npm run dev` on :3000. Stop it before `npm run build` (both use `.next`).
- Helper scripts (untracked, in `scripts/`): `_migrate.mjs` (postgres.js `.simple()` migration runner), `_verify.mjs` (count check), `_dbcheck.mjs` (connectivity). Run: `node -r dotenv/config scripts/<f>.mjs dotenv_config_path=.env.local`. Seed: `DOTENV_CONFIG_PATH=.env.local npx tsx src/db/seed/index.ts`.

## Reusable inventory (consume, do not rebuild)

- RBAC/auth: `@/lib/rbac` -> `getCurrentUser`, `requireUser`, `requirePermission(code)`, `hasPermission(user, code, scope?)`. `@/lib/auth` -> `auth`, `signIn`, `signOut`. Session user: `{id,email,name,roles[],permissions[],deptIds[],status}`, status in ACTIVE | PENDING_VERIFICATION | SUSPENDED.
- DB: `@/lib/db` -> `db` (drizzle over postgres.js, `prepare:false`). Schema barrels in `src/db/schema/*`. Seed catalogue `src/db/seed/catalogue.ts` already defines roles/permissions/departments for every feature.
- Design system (PR1): `@/lib/utils/cn`; `@/lib/utils/result` (`ActionResult<T>`, `ok`, `fail`); `@/lib/i18n` (`Locale`, `translate`, `LOCALE_COOKIE`) and `@/lib/i18n/server` (`getLocale`). Components: `@/components/ui/*` (button, card, badge, input, textarea, select, loading, empty-state, conflict-badge, citation-chip, chat-bubble, file-table, dialog, toast, calendar, date-time-range, form/field) and `@/components/shared/*` (nav, app-shell, breadcrumbs, language-toggle). LanguageToggle takes a `locale` prop. Component gallery at `/ui-preview`.

## Conventions (enforced; the reviewer checks them)

- const only, no reassignment; early returns, max 1 level of if-nesting; max 3 positional params (object beyond; React props exempt); no emojis; minimal comments.
- Tailwind v4 config-less: semantic token utilities only (`bg-card`, `text-muted-foreground`, ...); no raw hex; NO `dark:` variants — theming flips via the `.dark` class (`@custom-variant dark`).
- React 19 compiler on: no forwardRef / useMemo / useCallback. `"use client"` only where hooks or handlers are used.
- Next.js 16: route gating in `proxy.ts` (not `middleware.ts`); mutations via Server Actions returning `ActionResult<T>`; `cookies()` is async.

## Pitfalls — do not repeat

- Prettier: a route-group glob like `src/app/(public)/**` breaks (parens are extglob) and aborts the run; format new files by explicit path. A broad `src/lib/**` reformats unrelated base-branch files — target only this PR's new files.
- Seed/scripts load `dotenv/config`, which reads `.env`, not `.env.local`; pass `DOTENV_CONFIG_PATH=.env.local` (or `dotenv_config_path=.env.local` with `node -r dotenv/config`).
- `Cannot find module` for a dependency listed in package.json -> run `npm install` (lockfile had it, node_modules did not).
- Supabase: use the direct or session connection for the seed (transaction pooler :6543 rejects prepared statements). There is no `db:migrate` script; apply SQL with the `.simple()` runner.
- Subagents may touch files outside scope and may introduce a module-level `let`; review the diff and revert stray changes (for example accidental formatting of base-branch files). Use `crypto.randomUUID()` for ids, not a counter.

## Open decisions / debts

- Dev-only Gemini key rotation approved: 4 free keys plus paid fallback in local dev; single key in prod. ADR-007 addendum to be written in PR10 (rag-chat). Gemini keys and the synthetic NotebookLM documents are still owed by the human before PR10.
- Pre-existing repo-wide Prettier debt (~32 files from earlier PRs) — out of scope for the feature train; a dedicated `style:` pass can fix it.

## PR log

- PR1 (#37, `feat/design-system`): UI design system — Tailwind v4 tokens, cn/ActionResult/i18n, full `@/components` library, `/ui-preview`, ui-design-system.md. Verified green (typecheck, lint, build, tests); independent review plus a11y fixes (useId dialog ids, hydration-safe locale/calendar, aria-current, per-instance preview ids, immutable grid).
