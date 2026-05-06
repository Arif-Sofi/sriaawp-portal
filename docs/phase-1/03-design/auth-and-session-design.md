# Auth and Session Design

**Status.** Authored alongside PR #25 (`feat/auth-rbac`).

**Author.** Muhammad Arif Hakimi.

**Updated.** 2026-05-06.

## Goal

Document the wired-up shape of authentication and session handling for the SRIAAWP portal so that thesis-grade reviewers (and FYP2 contributors) can follow the request lifecycle end to end without reading the source. Implementation follows [`../05-tech-spikes/spike-authjs-v5-app-router.md`](../05-tech-spikes/spike-authjs-v5-app-router.md); deviations from the playbook are flagged inline.

## Stack snapshot

| Concern | Pin / choice | Source |
|---|---|---|
| Framework | Next.js 16.2.4 (App Router, React 19, React Compiler enabled) | [ADR-014](../00-meta/decision-log.md#adr-014--cache-components--cachecomponents-is-opt-out-for-v1-opt-routes-in-selectively), [ADR-015](../00-meta/decision-log.md#adr-015--keep-babel-plugin-react-compiler-enabled-with-reactcompiler-true) |
| Auth library | `next-auth@5.0.0-beta.30` (exact pin) | [ADR-017](../00-meta/decision-log.md#adr-017--pin-next-auth500-beta30-postgres-postgresjs-driver-and-resend-for-magic-link-delivery) |
| Adapter | `@auth/drizzle-adapter` (Postgres flavour) | [ADR-003](../00-meta/decision-log.md#adr-003--database-sessions-not-jwt), [ADR-016](../00-meta/decision-log.md#adr-016--drizzle-orm-as-the-schema-source-of-truth-drizzle-kit-for-generation-manual-sql-for-rls) |
| DB driver | `postgres` (postgres.js) with `prepare: false` | [ADR-017](../00-meta/decision-log.md#adr-017--pin-next-auth500-beta30-postgres-postgresjs-driver-and-resend-for-magic-link-delivery) |
| Session strategy | Database sessions (`session.strategy = "database"`) | [ADR-003](../00-meta/decision-log.md#adr-003--database-sessions-not-jwt) |
| Magic-link delivery | Resend (free tier dev; paid before production) | [ADR-017](../00-meta/decision-log.md#adr-017--pin-next-auth500-beta30-postgres-postgresjs-driver-and-resend-for-magic-link-delivery) |
| Edge runtime | Not used. `proxy.ts` runs on Node only. | [ADR-012](../00-meta/decision-log.md#adr-012--use-proxyts-not-middlewarets-on-the-nodejs-runtime-for-session-refresh-and-auth-gating) |
| Cookie name | `authjs.session-token` (v5 default) | Auth.js v5 changelog |

## File layout

```
proxy.ts                                          # auth gating per route group (Node only)
src/lib/auth.ts                                   # NextAuth({...}) singleton; exports handlers/auth/signIn/signOut
src/lib/auth/send-magic-link.ts                   # bilingual Resend send + dev console fallback
src/lib/db/index.ts                               # Drizzle client (postgres.js, prepare: false)
src/lib/rbac.ts                                   # getCurrentUser / requireUser / hasPermission / requirePermission
src/lib/rbac/types.ts                             # RoleCode / PermissionCode / UserStatus types
src/lib/rbac/session-context.ts                   # loadSessionContext(userId) — single join
src/types/next-auth.d.ts                          # Session.user augmentation
src/app/api/auth/[...nextauth]/route.ts           # GET/POST re-export from src/lib/auth
src/app/(auth)/login/page.tsx                     # bilingual /login Server Component
src/app/(auth)/login/login-form.tsx               # client form with Server Action
src/app/(auth)/login/check-email/page.tsx         # bilingual "magic link sent" page
src/app/(auth)/login/error/page.tsx               # generic auth error page
src/app/(parent)/parent/dashboard/page.tsx        # requireUser + PENDING_VERIFICATION short-circuit
src/app/(parent)/parent/dashboard/pending-approval-notice.tsx
src/app/(staff)/staff/dashboard/page.tsx          # requirePermission("staff:dashboard:read")
src/app/(admin)/admin/dashboard/page.tsx          # requirePermission("admin:dashboard:read")
```

## End-to-end magic-link flow

```mermaid
sequenceDiagram
    autonumber
    participant U as User (browser)
    participant L as /login page (RSC)
    participant A as Server Action (signIn)
    participant N as Auth.js handler
    participant R as Resend
    participant DB as Supabase Postgres
    participant CB as /api/auth/callback/resend

    U->>L: GET /login
    L-->>U: bilingual form (BM-first)
    U->>A: POST <form action={sendMagicLink}>
    A->>N: signIn("resend", {email, redirectTo})
    N->>DB: INSERT verification_token (identifier, token, expires)
    N->>R: emails.send({to, subject, text=bilingual body})
    R-->>U: email with magic link
    N-->>U: 302 -> /login/check-email
    U->>CB: GET /api/auth/callback/resend?token=...&email=...
    CB->>DB: DELETE verification_token (consume), INSERT sessions row
    CB-->>U: Set-Cookie authjs.session-token; 302 -> redirectTo
    U->>L: GET <protected page>
    Note right of U: proxy.ts runs auth(); req.auth resolves; allow.
```

In development the Resend send step short-circuits to `console.log` instead of an HTTP call (see `src/lib/auth/send-magic-link.ts`); the rest of the sequence is identical because the verification token row still exists in `verification_token` and the click-through path consumes it normally.

## proxy.ts — what it does and does not do

```ts
// proxy.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/parent", "/staff", "/admin"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

Behaviour:

- **Authenticated-vs-anonymous gating only.** RBAC is enforced inside Server Actions, Route Handlers, and RSC pages via `requirePermission` (per [ADR-002](../00-meta/decision-log.md#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth)). The proxy never inspects roles.
- **Node runtime only.** Edge runtime was dropped in Next.js 16 ([ADR-012](../00-meta/decision-log.md#adr-012--use-proxyts-not-middlewarets-on-the-nodejs-runtime-for-session-refresh-and-auth-gating)). `runtime = "edge"` must not be set.
- **Matcher excludes** `/api/*`, `_next/static/*`, `_next/image/*`, `favicon.ico`, and any URL with a file extension. `/login` is reachable to anonymous callers; the proxy short-circuits because it does not match `/parent|/staff|/admin`.
- **No `middleware.ts`.** Adding one is a v15-era anti-pattern under [ADR-012](../00-meta/decision-log.md#adr-012--use-proxyts-not-middlewarets-on-the-nodejs-runtime-for-session-refresh-and-auth-gating).

## Session callback — RBAC payload on the cookie

The `session` callback on the NextAuth config calls `loadSessionContext(user.id)` and stores the resolved roles, permissions, scope dept ids, and status on `session.user`. The augmentation is declared in `src/types/next-auth.d.ts`:

```ts
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image?: string | null;
      roles: RoleCode[];
      permissions: PermissionCode[];
      deptIds: string[];
      status: UserStatus;        // 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED'
    };
  }
}
```

`loadSessionContext` is a single Drizzle join across `user_role`, `roles`, `role_permission`, `permissions`, plus a `staff_profile.dept_id` lookup, and a parent-status check that reads the latest `parent_verification_request` row. The function is wrapped in `React.cache` so multiple `auth()` calls in one render pass do not repeat the join.

## PENDING_VERIFICATION parent flow

Per [ADR-009](../00-meta/decision-log.md#adr-009--rag-audience-admin-teacher-parent-student-excluded-in-v1) and [ADR-011](../00-meta/decision-log.md#adr-011--admin-only-parentstudent-linking-with-csv-bulk--per-family-edits), parents who self-register start with a `parent_verification_request.status = 'pending'` row and are surfaced as `status: 'PENDING_VERIFICATION'` on `session.user`. They CAN log in (they need to see they are pending), but every protected route short-circuits to a friendly bilingual notice instead of rendering data:

```tsx
// src/app/(parent)/parent/dashboard/page.tsx
const user = await requireUser();
if (user.status === "PENDING_VERIFICATION") return <PendingApprovalNotice />;
if (!hasPermission(user, "user:read:self")) forbidden();
return <ParentDashboard ... />;
```

`<PendingApprovalNotice>` is BM-first ("Akaun menunggu pengesahan / Account pending verification"). RBAC permissions like `event:read` are not granted while pending; routes that demand an active role return 403 via `requirePermission` rather than the friendly notice.

## Session-deletion-on-role-change rule

[ADR-003](../00-meta/decision-log.md#adr-003--database-sessions-not-jwt) is built around instant revocation. Every Admin Server Action that mutates `user_role` (grant, revoke, scope flip) MUST also delete the affected user's session rows in the same transaction:

```ts
await db.delete(sessions).where(eq(sessions.userId, targetUserId));
```

The user will see their next request redirect through `proxy.ts` to `/login`. The forced-logout banner UX (a friendlier "your session was refreshed" message) is tracked as a follow-up issue; the security primitive is in place from PR #25 as soon as the user-management Server Actions land.

## Test strategy

| Layer | Coverage in PR #25 | Tracked / deferred |
|---|---|---|
| Unit — `sendMagicLink` helper | `tests/auth/magic-link.test.ts` mocks `resend` and asserts: (a) dev fallback console-logs and does NOT call Resend, (b) production calls Resend with bilingual subject + body, (c) Resend errors propagate. | — |
| Unit — `requireUser` / `requirePermission` redirect/forbidden semantics | Indirectly via the RSC dashboards calling them; deeper unit tests deferred. | follow-up |
| Integration — magic-link DB round-trip (verification_token → session) | Skipped without `SUPABASE_TEST_URL` (mirrors `tests/db/rls.spec.ts` pattern). | live-DB CI follow-up |
| E2E — Playwright click-through `/login` → `/admin/dashboard` | Not wired. | follow-up issue |
| Production build | `next build` exercised locally with `AUTH_SECRET=ci-dummy-secret-32-bytes-of-random-data` and a synthetic `DATABASE_URL`; CI now sets the same env vars on the verify job. | — |

The CI workflow at `.github/workflows/ci.yml` adds an `env:` block on the verify job so `next build` and `npx drizzle-kit check` succeed without Vercel-side secrets.

## What is intentionally out of PR #25

These are tracked as separate GitHub issues so the auth PR stays reviewable:

- Admin user-management screens (invite, list, deactivate, role assign).
- Parent self-registration form + IC verification submission.
- Admin verify-pending-parents screen.
- Account deletion + email change flows (PDPA DSAR support per [ADR-008](../00-meta/decision-log.md#adr-008--pdpa-2010-aligned-design-from-day-1)).
- Force-logout-on-role-change banner UX.
- Passkeys / WebAuthn ([ADR-016](../00-meta/decision-log.md#adr-016--drizzle-orm-as-the-schema-source-of-truth-drizzle-kit-for-generation-manual-sql-for-rls) keeps the table out of MVP).
- Multi-factor and password fallback (not in scope; magic-link only).

## References

- [`../05-tech-spikes/spike-authjs-v5-app-router.md`](../05-tech-spikes/spike-authjs-v5-app-router.md) — implementation playbook this design pairs with.
- [`../03-design/folder-structure-spec.md`](folder-structure-spec.md) — locked target tree under `src/`.
- [`../03-design/database-schema.sql.md`](database-schema.sql.md), [`../03-design/rls-policy-design.md`](rls-policy-design.md) — schema and policy backdrop.
- [ADR-002](../00-meta/decision-log.md#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth), [ADR-003](../00-meta/decision-log.md#adr-003--database-sessions-not-jwt), [ADR-009](../00-meta/decision-log.md#adr-009--rag-audience-admin-teacher-parent-student-excluded-in-v1), [ADR-011](../00-meta/decision-log.md#adr-011--admin-only-parentstudent-linking-with-csv-bulk--per-family-edits), [ADR-012](../00-meta/decision-log.md#adr-012--use-proxyts-not-middlewarets-on-the-nodejs-runtime-for-session-refresh-and-auth-gating), [ADR-013](../00-meta/decision-log.md#adr-013--nest-pages-under-a-role-named-segment-inside-each-roles-parenthesised-route-group), [ADR-016](../00-meta/decision-log.md#adr-016--drizzle-orm-as-the-schema-source-of-truth-drizzle-kit-for-generation-manual-sql-for-rls), [ADR-017](../00-meta/decision-log.md#adr-017--pin-next-auth500-beta30-postgres-postgresjs-driver-and-resend-for-magic-link-delivery).
