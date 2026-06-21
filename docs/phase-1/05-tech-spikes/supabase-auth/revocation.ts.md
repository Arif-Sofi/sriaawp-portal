# Revocation under Supabase Auth (ADR-019) — reference snippet

Draft reference for the #79 cut-over. Held as `.ts.md` (not `.ts`) so the snippet
stays out of the TypeScript program and the migration runner. Promoted into a
server-only module during the cut-over.

```ts
// spike: reference snippet for the #79 cut-over. Revocation under Supabase Auth
// (ADR-019). NOT wired into live code. The "instant revocation" intent of the
// superseded ADR-003 is preserved by two layers:
//
//   1. App-layer-gated routes revoke effectively INSTANTLY. The next request
//      re-resolves permissions from the DB via loadSessionContext, so an admin
//      role change takes effect on the following request with no token churn.
//
//   2. The refresh token is dropped via the Supabase admin session-revoke below,
//      so a stale access token cannot be silently re-minted. Any claim-based RLS
//      check (a v2 authenticated-key concern) is bounded by the short access-
//      token TTL (target 5-15 min) rather than by an instant DB-session delete.
//
// API DISCREPANCY #79 MUST RECONCILE:
//   ADR-019 names `supabase.auth.admin.signOut(userId, 'global')`. The INSTALLED
//   auth-js admin API signature is `signOut(jwt: string, scope?)` -- it takes a
//   logged-in JWT, NOT a user id. There is no user-id session-revoke method in
//   this version. Two real options for a userId-keyed revoke:
//     (a) GoTrue admin REST: POST /admin/users/{id}/logout (the documented
//         "sign out user globally" endpoint), called directly with the service
//         key; or
//     (b) admin.deleteUser then re-provision -- heavier, not recommended for a
//         simple role change.
// The snippet below shows option (a) as the type-honest userId-keyed revoke.
//
// This requires the SERVICE-ROLE key (admin API). It must never run client-side.
function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

// Call on any role/permission change that must propagate now (role grant/revoke,
// account suspension, parent verification reject). Drops every refresh token for
// the user across all devices via the GoTrue admin logout endpoint.
export async function revokeUserSessions(userId: string): Promise<void> {
  const url = `${readEnv("NEXT_PUBLIC_SUPABASE_URL")}/auth/v1/admin/users/${userId}/logout`;
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scope: "global" }),
  });
  if (!response.ok) {
    throw new Error(`session revoke failed: ${response.status} ${await response.text()}`);
  }
}

// Production wiring step (Supabase dashboard, cannot be set from code here):
//   Authentication > Sign In / Providers > (Sessions) Access Token (JWT) expiry
//   -> 900 (15 min) or lower (300 = 5 min). Shorter TTL bounds claim-based RLS
//   staleness at the cost of more refresh round-trips. App-layer-gated paths are
//   unaffected by TTL because they re-resolve permissions per request.
```
