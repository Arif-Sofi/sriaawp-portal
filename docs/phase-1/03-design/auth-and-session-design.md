# Auth and Session Design

**Status.** Target design (post-2026-06-20 re-baseline). Supersedes the Auth.js v5 implementation shipped in PR #25; pending the Supabase-auth migration PR + spike.

**Author.** Muhammad Arif Hakimi.

**Updated.** 2026-06-21.

## Goal

Document the target shape of authentication and session handling for the SRIAAWP portal so that thesis-grade reviewers (and FYP2 contributors) can follow the request lifecycle end to end without reading the source. The design re-aligns the portal onto **Supabase Auth** as mandated by the 2026-06-20 stakeholder re-baseline (ADR-018) and the source-of-truth artefacts: thesis Chapter 3 and the Chapter 4 ERD already specify Supabase Auth with `profiles` connected to Supabase Auth's `auth.users`, and SRS UC01 lists "Login with Google" plus a "uses Supabase to hash" constraint. The Auth.js v5 stack documented in the previous revision of this file (shipped in PR #25) is superseded; the cut-over strategy that shields the existing consumers is in the final section.

This document pairs with the Supabase-auth migration PR and its spike (to be authored). Deviations from that playbook will be flagged inline once it lands.

## Stack snapshot

| Concern | Pin / choice | Source |
|---|---|---|
| Framework | Next.js 16 (App Router, React 19, React Compiler enabled) | ADR-014, ADR-015 |
| Auth library | Supabase Auth via `@supabase/ssr` (server-side cookie session helpers) | ADR-018 |
| Identity store | Managed `auth.users` (Supabase-owned schema; not in our DDL) | ADR-018 |
| App profile | `public.users` (ADR-018 "profiles" anchor; no rename), FK 1:1 to `auth.users.id` (uuid reused) | ADR-018 |
| Session strategy | Supabase JWT access token (short TTL) + refresh token, rotated via `@supabase/ssr` | ADR-019 |
| Magic-link / OTP delivery | Supabase email (built-in); Resend optionally retained as custom SMTP sender | ADR-018 |
| OAuth provider | Google (SRS UC01 "Login with Google") via Supabase | ADR-018, SRS UC01 |
| DB driver / ORM | Drizzle ORM over `postgres` (postgres.js, `prepare: false`); service-role connection in v1 | ADR-016, ADR-019 |
| Edge runtime | Not used. `proxy.ts` runs on Node only. | ADR-012 |
| Cookie name | `sb-<project-ref>-auth-token` (Supabase default; chunked when large) | Supabase SSR convention |
| Enforcement model | App-layer-primary (`requirePermission`) over a service-role connection in v1; RLS correct-but-bypassed | ADR-019, ADR-002 |

The drizzle-adapter rows, the `next-auth` pin, the database-session strategy, the `authjs.session-token` cookie, and the Resend-as-the-only-sender rows from the previous revision are all retired by ADR-018.

## Identity and profile model

ADR-018 moves identity into Supabase-managed `auth.users` while keeping the application's own profile row. The two are bound 1:1 on a shared uuid so that **every existing foreign key survives unchanged**.

- **`auth.users`** — owned and migrated by Supabase, never declared in our Drizzle schema or in `supabase/migrations/0000_*`. Supabase issues the uuid `id`, stores the credential / OAuth identity material, and hashes passwords (SRS UC01 "uses Supabase to hash"). Our code treats this table as read-only and reaches it only through the Supabase admin API.
- **`public.users`** (the ADR-018 "profiles" anchor) — the application profile, PK = FK `id uuid REFERENCES auth.users(id) ON DELETE CASCADE`. **Naming note (resolved by the #79 migration):** ADR-018 calls this anchor `public.profiles`, but the shipped schema has no `profiles` table — the real 1:1 anchor is `public.users` (uuid PK), with per-role detail in `parent_profile` / `staff_profile` / `student_profile`. Migration `0006` therefore targets `public.users` and performs **no rename**; "profiles" is kept as the logical/ERD label only. The uuid is **reused, not regenerated**, so `user_role.user_id`, `parent_profile.user_id`, `staff_profile.user_id`, `student_profile.user_id`, `family_link`, `parent_verification_request.user_id`, and the audit-log actor columns all continue to point at the same key. The human-facing columns (`name`, `email`, `image`, `created_at`, `updated_at`, `"emailVerified"`) live here; the credential / OAuth identity material lives in `auth.users`. Account `status` is **not** a column on `public.users` — it is derived per request from the latest `parent_verification_request` (see the hook and `resolveStatus`).

### Profile provisioning trigger

A row in `auth.users` does not by itself create the application profile. A Supabase on-insert trigger bridges the two so that the very first authenticated request already has a profile to join against:

```sql
-- supabase/migrations/0006_supabase_auth_cutover.sql (as shipped)
create or replace function public.provision_app_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, "emailVerified", created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.email_confirmed_at,
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.provision_app_user();
```

The trigger is `security definer` because `auth` is Supabase-owned; it is idempotent (`on conflict do nothing`) so that a backfill of pre-existing users and the live trigger cannot collide. The `"emailVerified"` column is the retained Auth.js adapter column (camelCase, quoted in DDL) populated from `auth.users.email_confirmed_at`. Role assignment is **not** done here — provisioning a profile is distinct from granting any role. New self-registering parents land with no roles and a `PENDING_VERIFICATION` status until an admin acts (ADR-011); see below.

### Dropped adapter tables

ADR-018 removes the Auth.js adapter surface entirely. The following tables, declared in the previous schema revision, are **dropped** in the migration:

- `accounts` — OAuth/credential linkage now lives inside `auth.users` / `auth.identities`.
- `sessions` — database sessions are gone; the session is a Supabase-issued JWT (see below).
- `verification_token` — magic-link / OTP token state is held by Supabase Auth.
- `authenticators` — WebAuthn/passkey table was forward-compatibility only and was never used; it leaves with the adapter.

`@auth/drizzle-adapter` and `next-auth` are removed from `package.json`. Drizzle **survives** as the ORM for every non-identity table (RBAC, profiles, content, events, documents); only the adapter integration is removed.

## Custom access-token hook — RBAC claims on the JWT

Supabase issues the session JWT, but it does not know our RBAC matrix. ADR-019 keeps the **application layer as the RBAC source of truth** and uses a Supabase **custom access-token hook** to inject only *lightweight* claims — role codes, account status, and department ids — into the token's `app_metadata`. The hook is a single Postgres function registered in the Supabase Auth config:

```sql
-- supabase/migrations/0006_supabase_auth_cutover.sql (as shipped, abridged)
-- Registered in Supabase Auth as the custom access-token hook (dashboard step).
create or replace function public.add_rbac_claims(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_user_id    uuid := (event ->> 'user_id')::uuid;
  v_role_codes text[];
  v_dept_ids   text[];
  v_status     text;
begin
  -- role_codes: every assigned role, by code
  select coalesce(array_agg(distinct r.code), '{}') into v_role_codes
  from public.user_role ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = v_user_id;

  -- dept_ids: staff_profile.dept_id UNION department-scoped user_role.scope_id
  select coalesce(array_agg(distinct d), '{}') into v_dept_ids
  from (
    select sp.dept_id::text d from public.staff_profile sp
      where sp.user_id = v_user_id and sp.dept_id is not null
    union
    select ur.scope_id::text d from public.user_role ur
      where ur.user_id = v_user_id and ur.scope_type = 'department'
  ) depts;

  -- status: ACTIVE for non-parents; for parents, the latest
  -- parent_verification_request decides (mirrors resolveStatus/loadParentStatus).
  -- There is NO status column on public.users; status is derived, never stored.
  if not ('parent' = any(v_role_codes)) then
    v_status := 'ACTIVE';
  else
    -- approved -> ACTIVE, rejected -> SUSPENDED, else PENDING_VERIFICATION
    v_status := /* derived from latest parent_verification_request.status */ 'PENDING_VERIFICATION';
  end if;

  return jsonb_set(
    event, '{claims,app_metadata}',
    coalesce(event #> '{claims,app_metadata}', '{}'::jsonb) || jsonb_build_object(
      'role_codes', to_jsonb(v_role_codes),
      'status',     to_jsonb(v_status),
      'dept_ids',   to_jsonb(v_dept_ids)
    )
  );
end;
$$;
```

(The full parent-status `case` is spelled out in the migration.) Design rules for the hook:

- **Lightweight only.** Role codes, status, and dept ids — never the full ~38-code permission catalogue. Permissions are resolved per-request in the app layer from `role_permission`, so a permission-matrix edit takes effect without re-minting tokens.
- **Re-evaluated on token mint and refresh.** Because access tokens are short-lived (below), a role change propagates into the claims on the next refresh without bespoke plumbing.
- **It does not replace `requirePermission`.** The claims are an ergonomics and RLS-correctness input, not an authorization decision. The note from the stakeholder re-baseline stands: Supabase gives auth + JWT claims only — the RBAC matrix, the permission catalogue, and the parent-verify flow remain hand-built.

This is the Supabase analogue of what the old `session` callback did when it projected roles onto the cookie; the difference is that the projection now happens inside Postgres at the identity tier and rides on a real signed JWT.

## End-to-end sign-in flow

```mermaid
sequenceDiagram
    autonumber
    participant U as User (browser)
    participant L as /login page (RSC)
    participant A as Server Action
    participant SB as Supabase Auth
    participant H as add_rbac_claims hook
    participant P as proxy.ts (Node)

    rect rgb(245,245,245)
    Note over U,SB: Magic-link / OTP path (signInWithOtp -> verifyOtp)
    U->>L: GET /login
    L-->>U: bilingual form (BM-first)
    U->>A: POST email (Server Action)
    A->>SB: supabase.auth.signInWithOtp({ email })
    SB-->>U: email with OTP / magic link
    U->>A: submit OTP token (or click link)
    A->>SB: supabase.auth.verifyOtp({ email, token, type })
    SB->>H: mint access token -> run hook
    H-->>SB: claims.app_metadata { role_codes, status, dept_ids }
    SB-->>U: Set-Cookie sb-<ref>-auth-token (access + refresh); 302 -> redirectTo
    end

    rect rgb(245,245,245)
    Note over U,SB: Google OAuth path (SRS UC01)
    U->>A: click "Login with Google"
    A->>SB: supabase.auth.signInWithOAuth({ provider: 'google' })
    SB-->>U: 302 -> Google consent
    U->>SB: GET /auth/callback?code=... (PKCE)
    SB->>H: mint access token -> run hook
    H-->>SB: claims.app_metadata { role_codes, status, dept_ids }
    SB-->>U: Set-Cookie sb-<ref>-auth-token; 302 -> redirectTo
    end

    U->>P: GET <protected page>
    P->>SB: getUser() (validates JWT; refreshes if near expiry)
    P-->>U: refreshed Set-Cookie + allow (or 302 -> /login)
```

In development, Supabase's local stack surfaces the OTP / magic-link in its Inbucket inbox (no outbound email needed); when Resend is wired as the custom SMTP sender the same flow delivers a real bilingual email. The OAuth callback lands on the Supabase-managed `/auth/callback` route handler, which exchanges the PKCE code for the session cookie. Both paths converge on the same cookie and the same hook-populated claims, so everything downstream of the callback is provider-agnostic.

## proxy.ts under @supabase/ssr

`proxy.ts` (not `middleware.ts`, per ADR-012) does two jobs: **anonymous-vs-authenticated gating** and the **mandatory Supabase token refresh**. The refresh is not optional plumbing — `@supabase/ssr` rotates the access token from inside the proxy and must write the rotated cookie back onto *both* the request and the response. Getting this wrong does not error; it **silently logs users out** as soon as the original access token expires.

```ts
// proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/parent", "/staff", "/admin"];

export async function proxy(req: NextRequest) {
  // The response must be the object Supabase writes refreshed cookies onto.
  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => req.cookies.set(name, value));
          cookies.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalidates the JWT against Supabase and triggers refresh-and-set.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!needsAuth) return res;
  if (user) return res;

  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

Behaviour (unchanged in intent from the previous revision; only the mechanism is Supabase):

- **Authenticated-vs-anonymous gating only.** RBAC is enforced inside Server Actions, Route Handlers, and RSC pages via `requirePermission` (ADR-002). The proxy never inspects roles, and it never reads `app_metadata` claims to make an authorization decision.
- **Mandatory refresh.** `getUser()` revalidates the token and, when it is near expiry, `@supabase/ssr` rotates it; the `setAll` shim above is what persists the rotated cookie. Returning a `NextResponse` that is *not* the one Supabase wrote to drops the refreshed cookie and logs the user out on the next hop.
- **`getUser`, not `getSession`.** `getUser()` is authenticated against Supabase; `getSession()` trusts the cookie unverified. The proxy uses `getUser()` for the security boundary.
- **Node runtime only.** Edge runtime was dropped in Next.js 16 (ADR-012). `runtime = "edge"` must not be set.
- **Matcher unchanged.** It still excludes `/api/*`, `_next/static/*`, `_next/image/*`, `favicon.ico`, and any URL with a file extension. `/login` is reachable to anonymous callers because it does not match `/parent|/staff|/admin`.
- **No `middleware.ts`.** Adding one is a v15-era anti-pattern under ADR-012.

## Enforcement and revocation model

ADR-019 reaffirms ADR-002: the **application layer stays the RBAC source of truth**. The enforcement and revocation posture for v1:

- **App-layer `requirePermission` is authoritative.** Every Server Action, Route Handler, and protected RSC page resolves the caller's effective permissions per-request from `role_permission` and gates the operation before any DB write. The JWT claims are an input to this resolution, not a substitute for it.
- **Service-role connection in v1.** The trusted server connects to Postgres through the Supabase service-role key, which **bypasses RLS by design**. Consequently `supabase/migrations/0001_rls_policies.sql` is *correct but bypassed* in v1: adopting Supabase Auth does **not** "light up" RLS for free. The RLS SQL needs no change — it now resolves real `auth.uid()` / `auth.jwt()` instead of the Auth.js-projected stand-ins — but it remains a dormant safety net until the v2 authenticated-key path lands. The authenticated-key + RLS-primary migration is **deferred to v2** (see rls-policy-design.md, which is updated in the same re-baseline).
- **Revocation = short TTL + per-request resolution + admin session-revoke.** There is no database-session row to delete anymore. Instead:
  1. **Short access-token TTL (5-15 min).** A stale grant cannot outlive one TTL window without a refresh, and the hook re-runs on refresh.
  2. **Per-request app-layer permission resolution.** For any route gated by `requirePermission`, a revoked permission takes effect *on the next request* (effectively instant), because permissions are resolved live from `role_permission`, not read off the token.
  3. **Admin session-revoke on role change.** Every Admin Server Action that mutates `user_role` (grant, revoke, scope flip) also calls the Supabase admin API to revoke the target user's sessions, forcing an immediate re-mint with fresh claims:

     ```ts
     // ADR-019 named `supabase.auth.admin.signOut(userId, 'global')`, but the
     // installed auth-js admin API has NO userId-keyed session-revoke: its
     // signOut(jwt, scope?) takes a logged-in JWT, not a user id. The
     // type-honest userId-keyed revoke is the GoTrue admin REST endpoint
     // POST /auth/v1/admin/users/{id}/logout, called with the service-role key.
     // See docs/phase-1/05-tech-spikes/supabase-auth/revocation.ts.md; #34
     // (force-logout) and #30 (admin user-management) consume this helper.
     await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${targetUserId}/logout`, {
       method: "POST",
       headers: {
         apikey: SERVICE_ROLE_KEY,
         Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({ scope: "global" }),
     });
     ```

- **Revocation-latency NFR.** For routes gated by the app layer (the common case), the worst-case window from an admin role change to enforcement is one request. For any decision that reads stale `app_metadata` claims directly (discouraged), the worst case is one access-token TTL (<= 15 min). The forced-logout banner UX ("your session was refreshed") remains a follow-up; the security primitive is in place.

## PENDING_VERIFICATION parent flow

The parent self-registration UX from the previous revision is preserved unchanged in intent (ADR-011). Parents who self-register provision a `public.users` row (via the provisioning trigger) and a pending `parent_verification_request` row, but **no roles**; their derived `status` is `PENDING_VERIFICATION`. The `status` claim rides in `app_metadata` for cheap gating, and the authoritative status is re-read server-side during session resolution. Such users **can** log in — they need to see that they are pending — but every protected route short-circuits to a friendly bilingual notice instead of rendering data. The `requireUser` short-circuit pattern is identical to before:

```tsx
// src/app/(parent)/parent/dashboard/page.tsx
const user = await requireUser();
if (user.status === "PENDING_VERIFICATION") return <PendingApprovalNotice />;
if (!hasPermission(user, "user:read:self")) forbidden();
return <ParentDashboard ... />;
```

`<PendingApprovalNotice>` stays BM-first ("Akaun menunggu pengesahan / Account pending verification"). No RBAC permission such as `event:read` is granted while pending; routes that demand an active role return 403 via `requirePermission` rather than the friendly notice. Admin approval grants the `parent` role and flips `status` to `ACTIVE`; the role change triggers the admin session-revoke above, so the parent's next request carries the new claims.

## Session-context loader

The public RBAC surface is **preserved**. `getCurrentUser`, `requireUser`, `hasPermission`, and `requirePermission` keep their exact signatures and semantics; only their internals change — they read the Supabase session instead of calling Auth.js `auth()`.

```ts
// src/lib/rbac.ts — signatures unchanged
export async function getCurrentUser(): Promise<AuthedUser | null>;
export async function requireUser(): Promise<AuthedUser>;          // redirects to /login if anon
export function hasPermission(user: AuthedUser, code: PermissionCode): boolean;
export async function requirePermission(code: PermissionCode): Promise<AuthedUser>; // forbidden() if denied
```

Internally:

- `getCurrentUser` now obtains the verified user from the request-scoped Supabase server client (`supabase.auth.getUser()`), reads `id` and `email`, then resolves `roles` / `permissions` / `deptIds` / `status` via the unchanged `loadSessionContext(userId)` — the same single Drizzle join across `user_role`, `roles`, `role_permission`, `permissions`, plus `staff_profile.dept_id` and the latest `parent_verification_request`. `loadSessionContext` stays wrapped in `React.cache`, so repeated calls in one render pass do not repeat the join. The `app_metadata` claims are a defense-in-depth/RLS-correctness input for the v2 authenticated-key path, **not** read by `getCurrentUser` in v1 — the DB resolution is authoritative.
- The exported type name is **`AuthedUser`** (kept from the previous revision so the ~48 consumers' `import { AuthedUser } from "@/lib/rbac"` is untouched); its shape (`id`, `email`, `name`, `image?`, `roles`, `permissions`, `deptIds`, `status`) is unchanged.

The previous revision augmented the `next-auth` `Session` type via `src/types/next-auth.d.ts`. That declaration file is removed; the `AuthedUser` type now lives in `src/lib/rbac/session-user.ts` and is re-exported from `src/lib/rbac.ts`, which is the single contract every consumer imports.

## Superseded shipped code and cut-over strategy

The previous revision shipped real code in PR #25. ADR-018 supersedes the following files; the migration PR removes or rewrites them:

| File | Fate |
|---|---|
| `src/lib/auth.ts` (`NextAuth({...})` singleton, session callback) | Removed. Replaced by `src/lib/supabase/server.ts` + `src/lib/supabase/client.ts` (`createServerClient` / `createBrowserClient` factories). |
| `src/lib/auth/send-magic-link.ts` | Removed. OTP / magic-link delivery is Supabase's; optional Resend custom-SMTP config moves to Supabase Auth settings. |
| `src/app/api/auth/[...nextauth]/route.ts` | Removed. Replaced by the Supabase code-exchange callback route handler (`src/app/auth/callback/route.ts`, `exchangeCodeForSession`). |
| `proxy.ts` | Rewritten onto `createServerClient` + `getUser()` + refresh-and-set (above). |
| `src/types/next-auth.d.ts` | Removed; the app-owned `AuthedUser` lives in `src/lib/rbac/session-user.ts` (re-exported from `src/lib/rbac.ts`). |

The cut-over is deliberately **localized to roughly five files** so the blast radius stays small. The shield is `src/lib/rbac.ts`: because `getCurrentUser` / `requireUser` / `hasPermission` / `requirePermission` keep their signatures, the **~48 call sites across the `(parent)`, `(staff)`, and `(admin)` route groups need no changes**. The migration swaps the identity backend underneath a stable interface — the application's authorization vocabulary is untouched. The login UI (`(auth)/login/*`) is re-pointed at `signInWithOtp` / `verifyOtp` and gains a "Login with Google" button (SRS UC01); the `check-email` and `error` pages survive with copy tweaks.

## Test strategy

| Layer | Target coverage |
|---|---|
| Unit — `getCurrentUser` / `requirePermission` / `hasPermission` | Mock the Supabase server client to return a fixed user + `app_metadata`; assert permission resolution, `forbidden()` on denial, and `PENDING_VERIFICATION` short-circuit. |
| Unit — `add_rbac_claims` hook (SQL) | pgTAP / SQL test against a seeded user: assert `role_codes`, `status`, `dept_ids` land in `claims.app_metadata` and that a user with no roles yields `[]` + `PENDING_VERIFICATION`. |
| Integration — handoff trigger | Insert into `auth.users` (local Supabase), assert a `public.users` row appears with the same uuid; assert idempotency on conflict. |
| Integration — proxy refresh | Drive `proxy.ts` with a near-expiry access token; assert the rotated `sb-<ref>-auth-token` cookie is written to the response (regression guard against the silent-logout bug). |
| E2E — Playwright | `/login` OTP round-trip via local Supabase Inbucket -> `/admin/dashboard`; Google OAuth happy path stubbed. Tracked as a follow-up issue (E2E not in CI yet). |
| Production build | `next build` with synthetic `NEXT_PUBLIC_SUPABASE_URL` / anon key / service-role key; CI verify job sets the same env vars. |

## What is intentionally out of scope

- **Google OAuth UI polish** — the button works (SRS UC01); brand-compliant styling and consent-copy refinement are follow-ups.
- **Passkeys / WebAuthn** — the `authenticators` table left with the adapter; no passkey login in v1.
- **Multi-factor authentication** — not in v1; OTP / magic-link + Google only.
- **Authenticated-key + RLS-primary migration (v2)** — v1 stays on the service-role connection with app-layer enforcement (ADR-019). Flipping the data path onto the authenticated key so RLS enforces is explicitly deferred to v2.
- **PDPA / consent artefacts** — recorded as a design constraint and dependency (ADR-008), not authored this pass: the FYP runs on synthetic data only, so no PDPA rule is yet engaged. DSAR-supporting flows (account deletion, email change) remain tracked for when real student data is introduced.

## Correction to ADR-019 — userId-keyed session revoke API

ADR-019 (status: Proposed) names the revoke call `supabase.auth.admin.signOut(userId, 'global')`. **That method does not exist in the installed auth-js admin API**, whose `signOut(jwt, scope?)` takes a logged-in JWT, not a user id. The implementation in this cut-over and in the downstream tickets (#30 admin user-management, #34 force-logout) must therefore use the GoTrue admin REST endpoint `POST /auth/v1/admin/users/{id}/logout` with the service-role key (see the revocation snippet in the "Enforcement and revocation model" section above and `docs/phase-1/05-tech-spikes/supabase-auth/revocation.ts.md`). This is a documentation-level correction recorded here per the ADR convention (Accepted ADRs are not edited in place; ADR-019 is Proposed and is corrected by this note rather than re-written). No admin session-revoke helper is wired by issue #79 itself — it ships with #30/#34.

## References

- Source docs — thesis Chapter 3 (Supabase Auth + RLS) and Chapter 4 ERD ("PROFILES connected to Supabase Auth's auth_users"); SRS UC01 ("Login with Google", "uses Supabase to hash"). See source-docs/thesis.md and source-docs/srs.md.
- ADR-018 — Replace Auth.js v5 with Supabase Auth (`@supabase/ssr`); supersedes ADR-017, revises ADR-002 / ADR-012 / ADR-016, reopens P0-Q6.
- ADR-019 — App layer stays the RBAC source of truth; custom access-token hook injects lightweight claims; service-role connection in v1, authenticated-key + RLS-primary deferred to v2.
- ADR-011 — Admin-only parent/student linking and parent self-registration approval (PENDING_VERIFICATION flow).
- ADR-012 — Use `proxy.ts`, not `middleware.ts`, on the Node.js runtime for session refresh and auth gating.
- ADR-008 — PDPA-2010-aligned design (recorded as a deferred dependency under synthetic-data scope).
- Companion design docs — rls-policy-design.md (RLS correct-but-bypassed in v1), database-schema.sql.md (`public.users` as the "profiles" anchor and the dropped adapter tables), folder-structure-spec.md (locked target tree under `src/`).
