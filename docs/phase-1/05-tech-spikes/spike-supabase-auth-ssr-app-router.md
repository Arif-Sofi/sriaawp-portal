# Spike — Supabase Auth via `@supabase/ssr@0.12.0` on Next.js 16 App Router

**Status.** Done (design + factories typecheck/build green; production-only steps documented, not executed — see §"Could not execute").
**Author.** Muhammad Arif Hakimi.
**Started / Completed.** 2026-06-21 / 2026-06-21.
**Effort.** ~0.5 day.

## Goal

Prove that Supabase Auth via `@supabase/ssr` works end-to-end on this stack (Next.js 16 App Router, React 19, Node runtime) and produce the canonical copy-paste patterns the cut-over PR (#79) will consume, before that PR is written. This spike **supersedes** [`spike-authjs-v5-app-router.md`](./spike-authjs-v5-app-router.md) per [ADR-018](../00-meta/decision-log.md#adr-018--replace-authjs-v5-with-supabase-auth-for-identity-and-sessions).

This spike is **additive only**. It does not remove `next-auth`, `@auth/drizzle-adapter`, `src/lib/auth.ts`, the adapter tables, or the live `proxy.ts` body. Auth.js stays the live auth until #79; the Supabase patterns land alongside.

## Versions pinned

| Package | Pin | Source |
|---|---|---|
| `@supabase/ssr` | `0.12.0` (exact, no caret) | `package.json`; resolved by `npm install` 2026-06-21 |
| `@supabase/supabase-js` | `^2.103.3` | already a dependency (was unused; now load-bearing per ADR-018) |
| `next` | `16.2.4` | already pinned ([`spike-nextjs-16.md`](./spike-nextjs-16.md)) |
| `react` / `react-dom` | `19.2.4` | already pinned |

The pin is exact (`"@supabase/ssr": "0.12.0"`) for the same reason `next-auth` is exact ([ADR-017](../00-meta/decision-log.md#adr-017--pin-next-auth500-beta30-postgres-postgresjs-driver-and-resend-for-magic-link-delivery)): the `@supabase/ssr` cookie API changed shape between minors (notably the `setAll(cookies, headers)` second argument), so a floating range plus `npm ci` would drift the cookie contract.

## Docs read (2026-06-21)

Per [`../../AGENTS.md`](../../../AGENTS.md), the locally installed sources are canonical and were read in preference to training-data assumptions:

- `node_modules/@supabase/ssr/dist/main/createServerClient.d.ts` — `createServerClient` signature; the `CookieMethodsServer` (`getAll`/`setAll`) contract; the deprecation of `get`/`set`/`remove`; the lazy-session note (`skipAutoInitialize: true`).
- `node_modules/@supabase/ssr/dist/main/types.d.ts` — the `setAll(cookiesToSet, headers)` signature **with the new second `headers` argument** in 0.12.0; the `getSession()`-is-not-verified / `getUser()`-is-verified warning; the CDN `Cache-Control: private, no-store` note.
- `node_modules/@supabase/ssr/dist/main/createBrowserClient.d.ts` — `createBrowserClient` signature.
- `node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.d.ts` — admin API: `signOut(jwt, scope)` **takes a JWT, not a user id** (discrepancy with ADR-019, see Pitfalls); `deleteUser(id, ...)`.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — `proxy(request: NextRequest)`, `NextResponse` API, Node-runtime-only (Edge dropped in v16) — matches [ADR-012](../00-meta/decision-log.md#adr-012--use-proxyts-not-middlewarets-on-the-nodejs-runtime-for-session-refresh-and-auth-gating).
- Supabase SSR server-side auth guide (https://supabase.com/docs/guides/auth/server-side/nextjs) — cross-checked after the local `.d.ts` reads.

## What this spike proves (and how)

The factories and the `updateSession` pattern were authored against the installed `.d.ts` types and pass `npm run typecheck` and `npm run build` green with Auth.js still wired as the live auth. The SQL hook/trigger and the revocation/TTL steps are authored as reviewable drafts; the parts that genuinely require a live Supabase project (registering the access-token hook, setting the JWT TTL, an actual OAuth round-trip) are flagged below as production-wiring steps rather than claimed as executed. This is a thesis audit trail: the design is proven to compile and to be internally consistent with the shipped RBAC code; it is **not** claimed to have run against the live SRIAAWP Supabase project (which would put synthetic identities into it prematurely and is out of scope per the task constraints).

## The five issue #11 tasks

### Task 1 — Cookie + refresh across proxy / RSC / Server Action

The `@supabase/ssr` contract is: **one** place writes cookies on every request (the proxy via `updateSession`), and RSC/Server-Action clients read those cookies and may write only when their context allows it. The pattern:

- `proxy.ts` (Node runtime) calls `updateSession(request)`, which creates a server client wired to `request.cookies.getAll()` for reads and to a single mutable `NextResponse` for writes, calls `supabase.auth.getUser()` (forcing any due token refresh **before** the response is committed), and returns that response carrying the rotated `Set-Cookie` headers.
- RSC reads use `createSupabaseServerClient()` (`src/lib/supabase/server.ts`), whose `setAll` is wrapped in `try/catch` because a Server Component's cookie store is read-only — the write would throw, and it is safe to swallow precisely because the proxy already refreshed the session for this request.
- Server Actions / Route Handlers use the same `createSupabaseServerClient()`; there the `cookies()` store **is** writable, so `setAll` succeeds and a refresh triggered inside a Server Action persists.

**Cookie-write race caveat (documented).** If RSC tried to refresh and write the rotated token itself, two problems arise: (a) a Server Component cannot set cookies, so the write is lost; (b) even where it can, a refresh that completes *after* the HTTP response is committed cannot emit `Set-Cookie`, so the next request refreshes again — a refresh storm that can also race two concurrent requests into minting divergent tokens. The `updateSession` pattern avoids this by making the **proxy** the single writer that runs before rendering: `getUser()` is awaited at the top of the request, the rotated cookie is written to the one `NextResponse`, and RSC only ever **reads** the already-fresh cookie. This is why `server.ts`'s `setAll` swallowing the read-only throw is correct rather than a silent bug.

Canonical files: `src/lib/supabase/update-session.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`.

### Task 2 — The custom access-token (RBAC) claims hook

A Postgres function `public.add_rbac_claims(event jsonb) returns jsonb` injects a **lightweight** claim set — `role_codes`, `status`, `dept_ids` — into `claims.app_metadata`. It mirrors the resolution in [`src/lib/rbac/session-context.ts`](../../../src/lib/rbac/session-context.ts) exactly: role codes from `user_role → roles.code`; `status` from the latest `parent_verification_request` (parents only; `approved → ACTIVE`, `rejected → SUSPENDED`, else `PENDING_VERIFICATION`); `dept_ids` from `staff_profile.dept_id` unioned with department-scoped `user_role.scope_id`.

The claim set is deliberately codes-only, not the 38+-code permission catalogue: [ADR-019](../00-meta/decision-log.md#adr-019--enforcement-and-revocation-under-supabase-auth) rejects claims-only enforcement, so the app keeps resolving permissions per request via `loadSessionContext` (the source of truth) and the claims exist only to make RLS correct on the future v2 authenticated-key path.

Draft: [`supabase-auth/add_rbac_claims.sql`](./supabase-auth/add_rbac_claims.sql). **Production-wiring step (Supabase dashboard):** register the hook at *Authentication → Hooks → Customize Access Token* and point it at `public.add_rbac_claims`. This cannot be done from application code and is **not** executed in this spike.

```sql
create or replace function public.add_rbac_claims(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  v_user_id uuid := (event ->> 'user_id')::uuid;
  v_role_codes text[];
  v_dept_ids text[];
  v_status text;
  v_latest_status text;
  v_claims jsonb;
begin
  select coalesce(array_agg(distinct r.code), '{}') into v_role_codes
  from public.user_role ur join public.roles r on r.id = ur.role_id
  where ur.user_id = v_user_id;

  select coalesce(array_agg(distinct d), '{}') into v_dept_ids
  from (
    select sp.dept_id::text d from public.staff_profile sp
      where sp.user_id = v_user_id and sp.dept_id is not null
    union
    select ur.scope_id::text d from public.user_role ur
      where ur.user_id = v_user_id and ur.scope_type = 'department'
  ) depts;

  if 'parent' <> all(v_role_codes) then
    v_status := 'ACTIVE';
  else
    select pvr.status into v_latest_status from public.parent_verification_request pvr
      where pvr.user_id = v_user_id order by pvr.created_at desc limit 1;
    v_status := case
      when v_latest_status is null or v_latest_status = 'approved' then 'ACTIVE'
      when v_latest_status = 'rejected' then 'SUSPENDED'
      else 'PENDING_VERIFICATION' end;
  end if;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(v_claims, '{app_metadata}',
    coalesce(v_claims -> 'app_metadata', '{}'::jsonb) || jsonb_build_object(
      'role_codes', to_jsonb(v_role_codes),
      'status', to_jsonb(v_status),
      'dept_ids', to_jsonb(v_dept_ids)));
  return jsonb_set(event, '{claims}', v_claims);
end; $$;
```

(The committed file additionally grants `supabase_auth_admin` execute/select on the read tables — required for the hook role.)

### Task 3 — Short-TTL revocation flow

[ADR-019](../00-meta/decision-log.md#adr-019--enforcement-and-revocation-under-supabase-auth) replaces ADR-003's database-session *mechanism* but preserves its instant-revocation *intent* with two layers:

1. **App-layer-gated routes revoke effectively instantly** — the next request re-resolves permissions from the DB via `loadSessionContext`, so an admin role change takes effect on the very next request with no token churn.
2. **Refresh tokens are dropped** on the role change via the GoTrue admin logout, and any claim-based RLS check (a v2 concern) is bounded by a short access-token TTL.

Draft: [`supabase-auth/revocation.ts.md`](./supabase-auth/revocation.ts.md). **Production-wiring step (Supabase dashboard):** set *Authentication → (Sessions) Access Token (JWT) expiry* to 300–900 s (5–15 min). This is a project setting, not code, and is **not** executed here.

### Task 4 — The `auth.users` ↔ profiles trigger

An `on auth.users insert` trigger provisions the app profile row reusing `NEW.id` as the PK, so every downstream FK survives without a data migration (ADR-018). Draft: [`supabase-auth/profiles_provisioning_trigger.sql`](./supabase-auth/profiles_provisioning_trigger.sql).

**Schema honesty (#79 must reconcile):** ADR-018 names `public.profiles` as the 1:1 anchor to `auth.users.id`, but the **current** schema ([`src/db/schema/auth.ts`](../../../src/db/schema/auth.ts)) has **no `profiles` table** — the anchor is the `users` table (uuid PK), with per-role detail split across `parent_profile` / `staff_profile` / `student_profile`. The trigger is therefore written against the **real** table name `public.users`. #79 decides whether to rename `public.users → public.profiles` or to keep `users` and treat ADR-018's "profiles" as the logical/ERD label. A second casing wrinkle: the Auth.js adapter column is `"emailVerified"` (quoted camelCase), which the promoted migration must match.

### Task 5 — Google OAuth + magic-link / OTP

Both are handled by Supabase Auth, replacing the Auth.js + Resend magic-link path (ADR-017, superseded). The browser client drives the flows:

```ts
// Magic-link / OTP (passwordless email)
const supabase = createSupabaseBrowserClient();
await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: `${location.origin}/auth/callback` },
});

// Google OAuth
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${location.origin}/auth/callback` },
});
```

The `/auth/callback` route (a Route Handler, not built in this spike) exchanges the code for a session via `createSupabaseServerClient().auth.exchangeCodeForSession(code)`, which writes the session cookie through the writable Server-Action/Route-Handler cookie store.

**Production-wiring step (Supabase dashboard):** Google OAuth requires *Authentication → Sign In / Providers → Google* enabled with a Google Cloud OAuth client id/secret and the project callback URL registered in Google Cloud Console. Magic-link/OTP works on the built-in Supabase email sender; Resend may be retained as the *custom SMTP sender* (*Project Settings → Auth → SMTP*) to keep BM-first bilingual branding (ADR-018). None of these dashboard/console steps is executed in this spike.

## Code patterns to copy in FYP2

```ts
// Pattern 1 — proxy.ts updateSession (Node runtime). The single cookie writer.
// src/lib/supabase/update-session.ts (full version committed in this PR).
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet)
          supabaseResponse.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers)) supabaseResponse.headers.set(k, v);
      },
    },
  });
  await supabase.auth.getUser(); // refresh before the response is committed
  return supabaseResponse;
}
```

```ts
// Pattern 2 — RSC / Server Action server client. Read-only setAll is swallowed
// because proxy.ts already refreshed this request. src/lib/supabase/server.ts.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          /* read-only store outside a Server Action / route handler */
        }
      },
    },
  });
}
```

```ts
// Pattern 3 — browser client. src/lib/supabase/client.ts.
export function createSupabaseBrowserClient() {
  return createBrowserClient(URL, ANON);
}
```

```ts
// Pattern 4 — proxy.ts wiring the cut-over (#79) will drop in. NOT applied here;
// the live proxy.ts keeps the Auth.js body until #79.
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/update-session";
const PROTECTED_PREFIXES = ["/parent", "/staff", "/admin"];
export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;
  if (!PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) return response;
  // gating reads request cookies via a client built on the same store, then
  // supabase.auth.getUser(); redirect to /login if absent. Keep the single
  // updateSession response so rotated cookies survive the redirect.
  return response;
}
export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
```

The matching SQL patterns are in [`supabase-auth/add_rbac_claims.sql`](./supabase-auth/add_rbac_claims.sql), [`supabase-auth/profiles_provisioning_trigger.sql`](./supabase-auth/profiles_provisioning_trigger.sql), and [`supabase-auth/revocation.ts.md`](./supabase-auth/revocation.ts.md).

## Pitfalls encountered

1. **`setAll` grew a second `headers` argument in 0.12.0.** Earlier `@supabase/ssr` examples show `setAll(cookiesToSet)`; the installed `types.d.ts` declares `setAll(cookiesToSet, headers)`, where `headers` carries the `Cache-Control: private, no-cache, no-store…` set that must ride on any response writing auth cookies (otherwise a CDN could serve one user's token to another). `updateSession` copies those headers onto the response. Pinning the version exactly is what keeps this contract stable.
2. **`admin.signOut` takes a JWT, not a user id — ADR-019 is inaccurate on the call shape.** ADR-019 names `supabase.auth.admin.signOut(userId, 'global')`, but the installed `GoTrueAdminApi.d.ts` declares `signOut(jwt: string, scope?)` and exposes no user-id session-revoke method. The type-honest userId-keyed revoke is the GoTrue admin REST endpoint `POST /auth/v1/admin/users/{id}/logout` with `{ scope: 'global' }`, called with the service key (shown in `revocation.ts.md`). **#79 must reconcile the ADR-019 wording with the real API.**
3. **`getSession()` is not verified; use `getUser()` for gating.** The `.d.ts` warns that `getSession()` reads cookies without contacting the Auth server, so its user object is unverified and unsafe for authorization. `updateSession` and any gating logic call `getUser()`, which validates the token server-side every call.
4. **RSC cannot write cookies.** A Server Component's `cookies()` store is read-only; the server client's `setAll` throws there. Swallowing it is correct only because the proxy is the single writer (see the race caveat). If the proxy were not wired, RSC reads would silently use stale tokens — the documented failure mode.
5. **`docs/**` is prettier-ignored but `tsconfig include` is `**/*.ts`.** A standalone `revocation.ts` under `docs/` would be pulled into the TypeScript program and typechecked as app code. It is therefore held as `revocation.ts.md` (fenced), matching the repo's `.sql.md` convention, so it stays a reviewable reference without entering the build.

## Decision

`@supabase/ssr@0.12.0` is the canonical SSR auth integration for the #79 cut-over on this stack. The three factories (`server.ts`, `client.ts`, `update-session.ts`) and the `updateSession`-in-`proxy.ts` pattern are the copy-paste shapes; the `add_rbac_claims` hook + `provision_app_user` trigger are the database-side shapes; revocation is GoTrue admin logout + short JWT TTL. The app keeps the **service-role connection and app-layer-primary enforcement** for v1 — adopting Supabase Auth does **not** "light up" the existing RLS (it stays correct-but-bypassed until the v2 authenticated-key migration), and this spike does not claim otherwise. Feeds ADR-018 / ADR-019; supersedes the Auth.js spike.

## Could not execute (production wiring, documented not run)

These genuinely require a live Supabase dashboard / Management API or an external console and were **not** performed (honest audit trail):

- **Register the access-token hook** — *Authentication → Hooks → Customize Access Token* → `public.add_rbac_claims`.
- **Set the JWT access-token TTL** to 300–900 s — *Authentication → (Sessions) Access Token expiry*.
- **Enable Google OAuth** — *Authentication → Sign In / Providers → Google* + Google Cloud OAuth client + registered callback URL.
- **Custom SMTP (optional Resend retention)** — *Project Settings → Auth → SMTP*.
- **An actual end-to-end OAuth / magic-link round-trip** against the live project — deferred so synthetic identities are not provisioned into the live SRIAAWP Supabase project prematurely (task constraint: do not register against the live project).

## Open questions / follow-up

- **`users` vs `profiles` naming** — #79 picks rename-vs-keep and normalises the `"emailVerified"` casing (Task 4).
- **ADR-019 `signOut` call shape** — correct the ADR text to the GoTrue admin logout endpoint (Pitfall 2).
- **DSAR cascade across `auth.users`** — ADR-018/ADR-008: deletion must span `auth.users` (admin API) **and** the app tables; the DSAR runbook owns this.
- **Auth.js teardown** — the actual removal of `next-auth`, `@auth/drizzle-adapter`, `src/lib/auth.ts`, adapter tables, and the `proxy.ts` body is #79, not this spike.

## References

- [ADR-018](../00-meta/decision-log.md#adr-018--replace-authjs-v5-with-supabase-auth-for-identity-and-sessions), [ADR-019](../00-meta/decision-log.md#adr-019--enforcement-and-revocation-under-supabase-auth); supersedes [ADR-017](../00-meta/decision-log.md#adr-017--pin-next-auth500-beta30-postgres-postgresjs-driver-and-resend-for-magic-link-delivery); relates to [ADR-002](../00-meta/decision-log.md#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth), [ADR-003](../00-meta/decision-log.md#adr-003--database-sessions-not-jwt), [ADR-012](../00-meta/decision-log.md#adr-012--use-proxyts-not-middlewarets-on-the-nodejs-runtime-for-session-refresh-and-auth-gating).
- [`spike-authjs-v5-app-router.md`](./spike-authjs-v5-app-router.md) (superseded), [`spike-nextjs-16.md`](./spike-nextjs-16.md) (house format, `proxy.ts`).
- Live code preserved by the cut-over: [`src/lib/rbac.ts`](../../../src/lib/rbac.ts), [`src/lib/rbac/session-context.ts`](../../../src/lib/rbac/session-context.ts), [`src/lib/db/index.ts`](../../../src/lib/db/index.ts), [`proxy.ts`](../../../proxy.ts).
- Draft SQL/TS: [`supabase-auth/add_rbac_claims.sql`](./supabase-auth/add_rbac_claims.sql), [`supabase-auth/profiles_provisioning_trigger.sql`](./supabase-auth/profiles_provisioning_trigger.sql), [`supabase-auth/revocation.ts.md`](./supabase-auth/revocation.ts.md).
- Issue #11 (this spike), #79 (the cut-over).
