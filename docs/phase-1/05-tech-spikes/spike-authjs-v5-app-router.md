# Spike — Auth.js v5 (`next-auth@5.0.0-beta.30`) on Next.js 16 App Router

**Status.** Done. Implementation landed in PR #25 (`feat/auth-rbac`). The "Hello-world reproduced" and "Pitfalls encountered" sections at the bottom of this file capture the wired-up file paths and the deviations the implementation forced.

**Author.** Muhammad Arif Hakimi.
**Started / Completed (research).** 2026-05-06 / 2026-05-06.
**Effort.** ~30 minutes (research only).

## Goal

Lock the integration design for **Auth.js v5 (`next-auth@5.0.0-beta`)** + **`@auth/drizzle-adapter`** on a **Next.js 16 App Router** project that uses **Supabase Postgres** as the database, **database sessions** (per ADR-003), magic-link login, and route-group-based role gating (per ADR-013). Output is the implementation brief for PR #25.

## Versions pinned

| Package | Pin | Source |
|---|---|---|
| `next` | `16.2.4` | already pinned (spike-nextjs-16.md) |
| `next-auth` | `5.0.0-beta.30` | npm latest beta on 2026-05-06; API stable since beta-22 |
| `@auth/drizzle-adapter` | `^1.x` (latest) | authjs.dev/getting-started/adapters/drizzle |
| `drizzle-orm` | `^0.36.x` | already pinned (PR #24) |
| `drizzle-kit` | `^0.28.x` (devDep) | already pinned (PR #24) |
| `postgres` | `^3.4.x` | postgres.js — Supabase pooler-compatible |
| `resend` | `^4.x` | resend.com |

## Docs read (2026-05-06)

- [Auth.js — Next.js install (v5)](https://authjs.dev/getting-started/installation?framework=Next.js)
- [Auth.js — Drizzle adapter](https://authjs.dev/getting-started/adapters/drizzle)
- [Auth.js — Migrating to v5](https://authjs.dev/getting-started/migrating-to-v5)
- [Auth.js — Session strategies](https://authjs.dev/concepts/session-strategies)
- [Auth.js — Resend provider](https://authjs.dev/getting-started/providers/resend)
- [Auth.js — Email/Nodemailer provider](https://authjs.dev/getting-started/authentication/email)
- [Auth.js — Protecting routes](https://authjs.dev/getting-started/session-management/protecting)
- [`next-auth/packages/adapter-drizzle/src/lib/pg.ts`](https://github.com/nextauthjs/next-auth/blob/main/packages/adapter-drizzle/src/lib/pg.ts) — adapter source
- [Drizzle — Postgres new](https://orm.drizzle.team/docs/get-started/postgresql-new)
- [Next.js 16 — proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Next.js 16 — cookies()](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [Resend pricing](https://resend.com/pricing)
- [next-auth on npm (5.0.0-beta.30)](https://www.npmjs.com/package/next-auth/v/5.0.0-beta.30)

Local references:
- [`spike-nextjs-16.md`](./spike-nextjs-16.md)
- [`../03-design/ui-references.md`](../03-design/ui-references.md)
- [`../00-meta/decision-log.md`](../00-meta/decision-log.md) — ADR-002, ADR-003, ADR-009, ADR-011, ADR-012, ADR-013, ADR-016

## Top-level decisions locked

| # | Decision | Rationale |
|---|---|---|
| 0.1 | **Pin `next-auth@5.0.0-beta.30`** + `@auth/drizzle-adapter@latest` | v5 beta API has shifted between betas; pin exactly so a `npm ci` in CI does not pick up a breaking beta. |
| 0.2 | **Database session strategy** (per ADR-003) | Instant revocation, audit-friendly, fits the role-flip flow. |
| 0.3 | **Magic-link via Resend** (provider: `next-auth/providers/resend`) | Free tier 100/day, 3,000/month; comfortably above expected FYP demo traffic. Single API key, single env var. Auth.js first-party provider. |
| 0.4 | **`postgres` driver (postgres.js), not `pg`** | Lower cold-start cost on serverless; matches Supabase pooler connection format. Drizzle docs accept either; we lock `postgres` for consistency. |
| 0.5 | **Auth runs Node-only** via `proxy.ts` (per ADR-012). Edge runtime is dropped in v16. | Drizzle + `postgres` driver + Node-only crypto fit Node, would not fit Edge. |
| 0.6 | **`authenticators` table NOT created in MVP.** | WebAuthn out of scope. Schema stays smaller; can be added later without breaking the magic-link flow. |

## 1. Auth.js v5 install + config (Next.js 16 App Router)

```bash
npm install next-auth@5.0.0-beta.30 @auth/drizzle-adapter
npm install postgres resend
npx auth secret
```

`AUTH_SECRET` is mandatory in v5 (replaces v4's `NEXTAUTH_SECRET`). Use the official `auth secret` command.

### `src/lib/auth.ts` — canonical shape

```ts
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema/auth";
import { loadSessionContext } from "@/lib/rbac/session-context";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "database",
    maxAge: 60 * 60 * 24 * 14,    // 14 days
    updateAge: 60 * 60 * 24,      // refresh row once per day
  },
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY!,
      from: process.env.AUTH_EMAIL_FROM ?? "no-reply@sriaawp.edu.my",
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login/error",
  },
  callbacks: {
    async session({ session, user }) {
      const ctx = await loadSessionContext(user.id);
      return {
        ...session,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: ctx.roles,
          permissions: ctx.permissions,
          deptIds: ctx.deptIds,
          status: ctx.status,
        },
      };
    },
  },
});
```

The export tuple `{ handlers, signIn, signOut, auth }` has been stable since beta-22; pinning beta-30 avoids drift.

### `src/app/api/auth/[...nextauth]/route.ts`

```ts
export { GET, POST } from "@/lib/auth";
```

### How `auth()` works

Universal helper. Replaces v4's `getServerSession`, `getSession`, `withAuth`, `getToken`, `useSession`. Works in:

- Server Components / Server Actions / Route Handlers → `Promise<Session | null>`.
- Wrapped middleware (`export const proxy = auth(...)`) → augmented `NextRequest` with `req.auth`.

Internally `await`s `cookies()` from `next/headers`, so it is compatible with Next.js 16's async request APIs without changes at the call site — call sites just `await auth()`.

## 2. Magic-link provider — Resend

| Vendor | Free tier (2026) | Domain setup | Auth.js native | Verdict |
|---|---|---|---|---|
| **Resend** | 100/day, 3,000/month, 1 custom domain | DNS TXT/MX (~5 min) | `next-auth/providers/resend` first-party | **Pick** |
| AWS SES (sandbox) | 200/day, recipients pre-verified | IAM + DKIM | Via Nodemailer | Sandbox forces verifying every recipient — unusable for parents. |
| Supabase Auth Email | Built-in but routes through Supabase Auth, not our `verification_token` table | n/a | Would bypass Auth.js | Conflicts with ADR-003. |
| Nodemailer + school SMTP | Depends on UTM/SRIAAWP IT | DNS via school | Yes | High friction; out of scope. |

**Decision: Resend.** Reconfirm before paid turn-on; Resend Pro at USD 20/mo if FYP2 demo exceeds 100/day.

```ts
Resend({
  apiKey: process.env.AUTH_RESEND_KEY!,
  from: "no-reply@sriaawp.edu.my",
});
```

Env vars (add to `.env.example`):

```dotenv
AUTH_SECRET=...
AUTH_RESEND_KEY=re_...
AUTH_EMAIL_FROM="SRIAAWP <no-reply@sriaawp.edu.my>"
AUTH_URL=https://portal.sriaawp.edu.my   # production only
```

### Bilingual magic-link template (BM-first per UI references)

Override `sendVerificationRequest` for branded HTML; keep BM line above EN line. Subject line example:

```
Pautan Log Masuk Portal SRIAAWP / SRIAAWP Portal Sign-in Link
```

Plain-text body:

```
Klik pautan ini untuk log masuk: {url}

Click this link to sign in: {url}

Pautan akan tamat dalam 24 jam. / Link expires in 24 hours.
```

### Local-dev capture (no real email)

```ts
Resend({
  apiKey: process.env.AUTH_RESEND_KEY ?? "dev-noop",
  from: process.env.AUTH_EMAIL_FROM!,
  sendVerificationRequest:
    process.env.NODE_ENV === "development"
      ? ({ url, identifier }) => {
          console.log(`\n[auth] magic link for ${identifier}:\n${url}\n`);
        }
      : undefined,
});
```

## 3. Drizzle adapter wiring

### Postgres client — `postgres` (postgres.js)

```ts
// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "@/db/schema/auth";
import * as appSchema from "@/db/schema/index";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false, max: 10 }); // pooler-friendly
export const db = drizzle(client, { schema: { ...authSchema, ...appSchema } });
```

`DATABASE_URL` should be the Supabase Transaction Pooler URL (port 6543) for serverless; `DATABASE_URL_DIRECT` (port 5432) for migrations.

### Auth.js adapter tables (already created in PR #24's `src/db/schema/auth.ts`)

PR #24 used Drizzle's pgTable with the column names that `@auth/drizzle-adapter` expects (`emailVerified`, `sessionToken`, etc.). Verify against the installed adapter source after `npm install`. **Do not rename to snake_case** — the adapter SELECTs by the literal camelCase strings.

### Connection pool gotchas

- Transaction Pooler (6543) needs `prepare: false` — required by PgBouncer.
- Direct (5432) for migrations and `drizzle-kit push`.
- Edge runtime is irrelevant (ADR-012 — Node-only).

## 4. Session callback — RBAC info on the session

```ts
// src/types/next-auth.d.ts
import "next-auth";
import type { RoleCode, PermissionCode, UserStatus } from "@/lib/rbac/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      roles: RoleCode[];
      permissions: PermissionCode[];
      deptIds: string[];
      status: UserStatus;          // 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED'
    };
  }
}
```

`loadSessionContext(userId)` runs a single join across `user_role`, `role_permission`, `permission`, `staff_profile.dept_id` and returns the denormalised view. Wrap in `React.cache` so multiple `auth()` calls in one render don't repeat the join.

### Session invalidation on permission change

Per ADR-003 (instant revocation is *the* reason we picked DB sessions). Every Admin-driven role mutation must:

```ts
await db.delete(sessions).where(eq(sessions.userId, targetUserId));
```

Wire into `user-management` Server Actions that grant/revoke roles. Audit-log the deletion.

## 5. `proxy.ts` shape

```ts
// proxy.ts (project root)
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/parent", "/staff", "/admin"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();
  if (req.auth) return NextResponse.next();
  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

Do **NOT** do RBAC here — only authenticated-vs-not. RBAC lives in Server Actions (ADR-002 + spike-nextjs-16 pitfall 8). `proxy.ts` runs on Node only in v16 — no `runtime` config option.

Cookie name in v5: `authjs.session-token` (renamed from `next-auth.session-token`).

## 6. `src/lib/rbac.ts` — server-side helpers

```ts
import { redirect, forbidden } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import type { PermissionCode } from "@/lib/rbac/types";

export type AuthedUser = NonNullable<Session["user"]>;

export async function getCurrentUser(): Promise<AuthedUser | null> {
  return (await auth())?.user ?? null;
}

export async function requireUser(redirectTo = "/login"): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

export function hasPermission(
  user: Pick<AuthedUser, "permissions" | "deptIds">,
  code: PermissionCode,
  scope?: { deptId?: string },
): boolean {
  if (!user.permissions.includes(code)) return false;
  if (scope?.deptId && !user.deptIds.includes(scope.deptId)) return false;
  return true;
}

export async function requirePermission(
  code: PermissionCode,
  scope?: { deptId?: string },
): Promise<AuthedUser> {
  const user = await requireUser();
  if (!hasPermission(user, code, scope)) forbidden();
  return user;
}
```

`forbidden()` and `redirect()` are Next.js 16 navigation helpers; both throw, so callers don't need explicit returns.

## 7. Login flow UX (magic-link)

1. User opens `/login`, enters email, submits Server Action `signIn("resend", { email, redirectTo })`.
2. Auth.js writes `verification_token` row, calls our `sendVerificationRequest`.
3. Redirect to `/login/check-email`. UI shows bilingual "magic link sent" copy.
4. User clicks link → `/api/auth/callback/resend?token=...&email=...`.
5. Auth.js consumes the token (deletes row), creates a `session` row, sets `authjs.session-token` cookie.
6. Redirect to `callbackUrl` if present, else `/`.
7. `proxy.ts` reads the new session and lets them through.

### PENDING_VERIFICATION parent flow (ADR-009 + ADR-011)

Parents who self-register but are not Admin-approved have `status = 'PENDING_VERIFICATION'`. They CAN log in (so they see they are pending). Every authenticated route enforces:

```ts
const user = await requireUser();
if (user.status === "PENDING_VERIFICATION") return <PendingApprovalNotice />;
```

`(parent)/parent/layout.tsx` short-circuits to a friendly notice. Permissions like `event:read` are not granted while pending; routes that require an active role return 403 via `requirePermission`.

### Bilingual UX copy

```
[BM] Pautan log masuk telah dihantar ke {email}.
     Sila semak peti masuk anda dan klik pautan untuk teruskan.
     Pautan ini akan tamat dalam masa 24 jam.

[EN] A sign-in link has been sent to {email}.
     Please check your inbox and click the link to continue.
     This link will expire in 24 hours.
```

### Login page styling — UTM My Portal aesthetic

Per `docs/phase-1/03-design/ui-references.md`, the login page should echo UTM My Portal's clean school-portal aesthetic, but adapted to SRIAAWP brand (teal/turquoise + yellow, BM-first).

```tsx
<main className="min-h-dvh grid place-items-center bg-gradient-to-b from-teal-50 to-white">
  <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md ring-1 ring-slate-100">
    <header className="mb-6 flex flex-col items-center gap-3">
      <SriaawpLogo className="h-14 w-14" />
      <h1 className="text-xl font-semibold text-slate-900">Portal SRIAAWP</h1>
      <p className="text-sm text-slate-500">Log Masuk / Sign in</p>
    </header>
    <LoginForm />
    <footer className="mt-6 text-center text-xs text-slate-400">
      Sekolah Rendah Islam Antarabangsa Wilayah Persekutuan
    </footer>
  </section>
</main>
```

Confirm exact colour tokens once the brand-tokens spike runs.

## 8. Per-role dashboard rendering

```tsx
// (parent)/parent/dashboard/page.tsx
export default async function ParentDashboardPage() {
  const user = await requireUser();
  if (user.status === "PENDING_VERIFICATION") return <PendingApprovalNotice />;
  if (!hasPermission(user, "user:read:self")) forbidden();
  return <ParentDashboard userId={user.id} />;
}

// (staff)/staff/dashboard/page.tsx
export default async function StaffDashboardPage() {
  const user = await requirePermission("staff:dashboard:read");
  return <StaffDashboard deptIds={user.deptIds} />;
}

// (admin)/admin/dashboard/page.tsx
export default async function AdminDashboardPage() {
  await requirePermission("admin:dashboard:read");
  return <AdminDashboard />;
}
```

(Permission codes `staff:dashboard:read` and `admin:dashboard:read` are added to the RBAC catalogue if not already present in PR #24's seed.)

## 9. Common pitfalls to avoid

1. **Forgetting `await cookies()`/`headers()`.** Sync access throws in v16. Always `await auth()` (it `await`s internally).
2. **Redirect loops in `proxy.ts`.** If `/login` is in the matched set, anonymous users on `/login` redirect to `/login` → loop. The matcher in §5 excludes everything not under protected prefixes.
3. **Session strategy mismatch.** Setting `strategy: "database"` but reading `token` in the session callback returns `undefined`. Always destructure `{ session, user }` under DB strategy.
4. **`pg` vs `postgres` driver mix-up.** Drizzle has two import paths: `drizzle-orm/node-postgres` for `pg`, `drizzle-orm/postgres-js` for `postgres`. We use the latter — make sure `drizzle.config.ts` matches.
5. **Supabase Pooler + prepared statements.** Forgetting `{ prepare: false }` produces "prepared statement does not exist" runtime errors. Always set it.
6. **Drizzle column casing.** Adapter SELECTs by camelCase column names (`emailVerified`, `sessionToken`). Don't rename to snake_case.
7. **`AUTH_SECRET` not set in CI.** Production-mode `next build` checks for it. Add `AUTH_SECRET=ci-dummy-secret` to CI envs.
8. **`AUTH_URL` in Vercel.** Custom domains need `AUTH_URL=https://portal.sriaawp.edu.my` set explicitly.
9. **Server Functions reachable as POST.** Every Server Action MUST call `auth()` + `requirePermission` itself. The proxy is not a substitute (spike-nextjs-16 pitfall 8).
10. **Session cookie name change.** v5 uses `authjs.session-token`. Tests, log filters, monitoring need updating.
11. **Forgetting to delete session rows on role change.** ADR-003's whole point. Wire into every role-mutation Server Action.

## 10. Test strategy for PR #25

### Vitest integration test (mock Resend)

```ts
// tests/auth/magic-link.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { users, sessions, verificationTokens } from "@/db/schema/auth";
import { eq } from "drizzle-orm";

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: "mock-id" }) },
  })),
}));

beforeEach(async () => {
  await db.delete(sessions);
  await db.delete(verificationTokens);
  await db.delete(users);
  await seedAdminUser({ email: "admin@sriaawp.edu.my" });
});

it("creates a session for a verified admin", async () => {
  await callSignIn({ email: "admin@sriaawp.edu.my" });
  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.identifier, "admin@sriaawp.edu.my"));
  const res = await callCallback({ identifier: row.identifier, token: row.token });
  expect(res.status).toBe(302);
  const [user] = await db.select().from(users).where(eq(users.email, "admin@sriaawp.edu.my"));
  const [session] = await db.select().from(sessions).where(eq(sessions.userId, user.id));
  expect(session).toBeTruthy();
});
```

### Optional Playwright e2e

Click-through from `/login` → email mailbox capture → `/admin/dashboard`.

Skip the e2e in CI for now (Playwright browsers + live DB requirement). Track in an issue.

## 11. Open questions

1. **Session callback latency** at FYP demo scale (~50 RPS). Cache by `sessionToken` in Redis if too slow — Redis not yet in stack.
2. **Resend deliverability to school inboxes.** UTM and SRIAAWP IT may filter unknown senders; deliverability dry-run before FYP1 demo.
3. **`v5.0.0-beta.30` API stability.** GA could land before FYP2 implementation; re-pin when GA ships.
4. **Forced logout UX.** When Admin flips a role and we delete sessions, the user mid-session sees their next request 302 to `/login`. Need a friendly "your session has been refreshed; please log in again" message — design TBD.
5. **Supabase `auth.jwt()` claim shape (ADR-002).** Defense-in-depth RLS expects `auth.jwt() ->> 'sub'` to be the user id. Auth.js DB sessions don't issue a JWT — RLS will instead read a custom claim set via `db.execute(sql\`SET LOCAL app.user_id = ...\`)` per request. Plan a follow-up spike.

## 12. Ready-to-execute brief — for PR #25

> Implement Auth.js v5 magic-link auth with Drizzle adapter on Supabase Postgres, per this playbook. Specifically:
>
> 1. Add deps: `next-auth@5.0.0-beta.30`, `@auth/drizzle-adapter`, `postgres`, `resend`. Run `npx auth secret` and add `AUTH_SECRET`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`, `DATABASE_URL`, `DATABASE_URL_DIRECT` to `.env.example`.
> 2. Create `src/lib/db/index.ts` with `postgres` driver + Drizzle wrapper, `prepare: false`.
> 3. Verify `src/db/schema/auth.ts` (already created in PR #24) exposes `users`, `accounts`, `sessions`, `verificationTokens` with the camelCase column names the adapter expects.
> 4. Create `src/lib/auth.ts` per §1 with the Resend provider, database session strategy, and the session callback that loads RBAC context.
> 5. Create `src/app/api/auth/[...nextauth]/route.ts` with the one-line export.
> 6. Create `proxy.ts` at project root per §5.
> 7. Create `src/lib/rbac.ts` with `getCurrentUser`, `requireUser`, `hasPermission`, `requirePermission` per §6.
> 8. Create `src/types/next-auth.d.ts` augmenting `Session["user"]` per §4.
> 9. Wire `src/lib/rbac/session-context.ts` to fetch roles/permissions/dept-ids via Drizzle in a single join. Wrap in `React.cache`.
> 10. Update `src/app/(parent|staff|admin)/.../dashboard/page.tsx` to call `requireUser` / `requirePermission` per §8.
> 11. Build `/login/page.tsx` with the bilingual form, `signIn("resend", ...)` Server Action, UTM-portal-inspired Tailwind layout per §7.
> 12. Add Vitest integration test from §10 with the Resend mock.
> 13. Author `docs/phase-1/03-design/auth-and-session-design.md` covering the proxy.ts shape, cookie name, PENDING_VERIFICATION flow, session-deletion-on-role-change rule.
> 14. Append ADR-017 to `decision-log.md` recording: Resend pick + `postgres` driver + v5 beta pin.
> 15. Update `docs/phase-1/00-meta/pr-stack.md` with this PR.
> 16. CI must pass `lint`, `typecheck`, `format:check`, `test`. Add `AUTH_SECRET=ci-dummy-secret` to the CI env.
> 17. Do NOT enable `cacheComponents`. Do NOT add a `middleware.ts`. Do NOT enforce RBAC inside `proxy.ts`. Stay on Node runtime.

## 13. Hello-world reproduced — file paths from PR #25

| Concern | File |
|---|---|
| Auth.js singleton (NextAuth config) | `src/lib/auth.ts` |
| Magic-link send + dev console fallback | `src/lib/auth/send-magic-link.ts` |
| Drizzle client (postgres.js, `prepare: false`) | `src/lib/db/index.ts` |
| Session-context loader (single join, `React.cache`) | `src/lib/rbac/session-context.ts` |
| RBAC types (RoleCode / PermissionCode / UserStatus) | `src/lib/rbac/types.ts` |
| Server-side helpers (getCurrentUser / requireUser / requirePermission / hasPermission) | `src/lib/rbac.ts` |
| Session.user augmentation | `src/types/next-auth.d.ts` |
| NextAuth route handler | `src/app/api/auth/[...nextauth]/route.ts` |
| `proxy.ts` (auth gating, Node runtime) | `proxy.ts` |
| Login page (Server Component + Server Action) | `src/app/(auth)/login/page.tsx` |
| Login form (Client Component, `useFormStatus`) | `src/app/(auth)/login/login-form.tsx` |
| "Magic link sent" page (bilingual) | `src/app/(auth)/login/check-email/page.tsx` |
| Auth error page (bilingual) | `src/app/(auth)/login/error/page.tsx` |
| Parent dashboard (PENDING_VERIFICATION short-circuit) | `src/app/(parent)/parent/dashboard/page.tsx` |
| `<PendingApprovalNotice>` | `src/app/(parent)/parent/dashboard/pending-approval-notice.tsx` |
| Staff dashboard (`requirePermission("staff:dashboard:read")`) | `src/app/(staff)/staff/dashboard/page.tsx` |
| Admin dashboard (`requirePermission("admin:dashboard:read")`) | `src/app/(admin)/admin/dashboard/page.tsx` |
| Vitest integration test (mocked Resend) | `tests/auth/magic-link.test.ts` |
| Auth and session design doc | `docs/phase-1/03-design/auth-and-session-design.md` |
| ADR | `docs/phase-1/00-meta/decision-log.md` § ADR-017 |

## 14. Pitfalls encountered (deviations from the playbook)

1. **Resend mock must be a class.** The test in §10 mocked `resend` with `vi.fn(() => ({ emails: { send } }))`, which fails when `send-magic-link.ts` calls `new Resend(apiKey)` — vitest reports "is not a constructor". Fix: mock with a real `class Resend { emails = { send: sendMock }; }`. Updated in `tests/auth/magic-link.test.ts`.
2. **`process.env.NODE_ENV` is read-only at runtime under Vitest.** The naive `process.env.NODE_ENV = "production"` pattern from §10 throws `TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor`. Use `vi.stubEnv("NODE_ENV", "production")` and pair with `vi.unstubAllEnvs()` in `afterEach`.
3. **`sendVerificationRequest` extracted to a helper.** Inlining the entire `Resend` provider's `sendVerificationRequest` callback in `src/lib/auth.ts` was hard to unit-test because Auth.js's `NextAuth({...})` does not expose the constructed providers in a reachable way. Refactor extracted the email-sending logic into `src/lib/auth/send-magic-link.ts`. The provider's `sendVerificationRequest` is now a one-liner that delegates to the helper.
4. **`provider.apiKey` and `provider.from` can be `string | undefined`** in the v5 callback shape. The playbook code in §1.2 dereferenced them directly, which trips strict TS. Use `typeof provider.apiKey === "string" ? provider.apiKey : "dev-noop"`.
5. **`PgDatabase` adapter signature.** The playbook showed the adapter taking a positional schema-keys object; the actual `DrizzleAdapter(db, schema?)` signature accepts an object with `usersTable / accountsTable / sessionsTable / verificationTokensTable`. The playbook example was already correct; flagging here so future readers don't second-guess.
6. **Permission seeding.** The playbook required `staff:dashboard:read` and `admin:dashboard:read`. PR #24's catalogue did not have them; PR #25 adds both to `src/db/seed/catalogue.ts` and grants `staff:dashboard:read` to the `teacher` role (admin auto-receives all permissions via the `admin: PERMISSIONS.map((p) => p.code)` wildcard).
7. **CI env block.** Production-mode `next build` requires `AUTH_SECRET`. PR #25 adds `env: { AUTH_SECRET, DATABASE_URL }` to the verify job in `.github/workflows/ci.yml`. Without this, the job fails at `npx drizzle-kit check` time because the schema imports `@/lib/db` indirectly via the seed test resolution path.

## References

- Sources listed under "Docs read" above.
- Local: `spike-nextjs-16.md`, `../03-design/ui-references.md`, `../03-design/auth-and-session-design.md`, `../00-meta/decision-log.md`.
