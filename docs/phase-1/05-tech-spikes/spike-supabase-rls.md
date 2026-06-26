# Spike — Supabase Row Level Security against the `add_rbac_claims` JWT contract

**Status.** Done (policy + reusable test authored, typecheck/lint/build green, integration suite env-gated and skipping; live-project execution deliberately out of scope — see §"Could not execute").
**Author.** Muhammad Arif Hakimi.
**Started / Completed.** 2026-06-21 / 2026-06-21.
**Effort.** ~0.5 day.

## Goal

Write a sample Supabase RLS policy, demonstrate it blocks an unauthorised cross-tenant read, confirm the exact JWT claim shape the policy reads, and build a reusable integration-test pattern that later RLS work can call. This spike retires tech-risk #12.

## Versions pinned

- `@supabase/supabase-js@^2.103.3` (already a dependency; load-bearing per [ADR-018](../00-meta/decision-log.md#adr-018--replace-authjs-v5-with-supabase-auth-for-identity-and-sessions))
- `vitest@^4.1.5` (env-gated integration suite)
- Postgres / Supabase RLS + `auth.uid()` / `auth.jwt()` (managed; no version pin)

## Decision context

This spike sits downstream of two re-baseline ADRs:

- **[ADR-018](../00-meta/decision-log.md#adr-018--replace-authjs-v5-with-supabase-auth-for-identity-and-sessions)** — identity moves to Supabase `auth.users`; the **app PK is reused** as `auth.users.id`, so `auth.uid()` resolves to the same uuid as the app user PK and every FK ownership column (`parent_profile.user_id`, `news.author_user_id`, ...) maps directly onto `auth.uid()` with no lookup.
- **[ADR-019](../00-meta/decision-log.md#adr-019--enforcement-and-revocation-under-supabase-auth)** — the custom access-token hook `public.add_rbac_claims` injects `role_codes`, `status`, `dept_ids` into the JWT **`app_metadata`** (server-controlled, user cannot edit). The app keeps the **service-role connection for v1**, so the authored RLS is correct-but-bypassed; the authenticated-key path that enforces it is deferred to v2.

## The JWT claim contract (shared with `add_rbac_claims`)

The sample policy reads exactly the shape that [`supabase-auth/add_rbac_claims.sql`](./supabase-auth/add_rbac_claims.sql) emits. `add_rbac_claims` writes into `claims.app_metadata`:

```text
app_metadata.role_codes : jsonb array of role codes   (to_jsonb(text[]))
app_metadata.status     : jsonb string                 (ACTIVE | PENDING_VERIFICATION | SUSPENDED)
app_metadata.dept_ids   : jsonb array of dept ids       (uuid cast to text, then to_jsonb)
```

The policy reads them back via:

| Concept | Path the policy reads | Matches `add_rbac_claims` write |
|---|---|---|
| Requester identity | `auth.uid()` | `auth.users.id` = app PK (ADR-018 reuse) |
| Role membership | `auth.jwt() -> 'app_metadata' -> 'role_codes'` (jsonb `?` contains) | `jsonb_build_object('role_codes', to_jsonb(v_role_codes))` |
| Department scope | `auth.jwt() -> 'app_metadata' -> 'dept_ids'` (jsonb `?` contains) | `jsonb_build_object('dept_ids', to_jsonb(v_dept_ids))` |

Two points are load-bearing and were verified against the hook source:

1. The claims are under **`app_metadata`**, not `user_metadata`. `app_metadata` is server-controlled (only the auth admin / hook can write it), so RLS may trust it; `user_metadata` is user-editable and must never gate authorisation.
2. `dept_ids` is emitted as **text** (`sp.dept_id::text`, `ur.scope_id::text`), so the policy compares against `dept_id::text` rather than the raw uuid. This is why `jwt_in_dept` takes `text` and the `news` policy passes `dept_id::text`.

## The sample policy

Full reviewable SQL: [`supabase-rls/sample-policy.sql`](./supabase-rls/sample-policy.sql). It is a reference file outside `supabase/migrations/` (the drizzle-kit journal is undisturbed), mirroring how spike #11 kept `add_rbac_claims.sql`. It demonstrates both required predicate shapes.

**(a) Ownership predicate** — `auth.uid() = parent_profile.user_id`. `parent_profile.user_id` is the PK and equals `auth.uid()` under ADR-018, so the check is a direct comparison:

```sql
CREATE POLICY sample_parent_profile_owner_select ON "parent_profile"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

**(b) Role / dept predicate** — reads both claim arrays. A staff member updates a `news` row when they authored it OR they hold the `editor` role for the row's department:

```sql
CREATE POLICY sample_news_author_or_dept_editor_update ON "news"
  FOR UPDATE TO authenticated
  USING (
    author_user_id = auth.uid()
    OR (
      public.jwt_has_role('editor')
      AND dept_id IS NOT NULL
      AND public.jwt_in_dept(dept_id::text)
    )
  )
  WITH CHECK ( ... same ... );
```

The two helper functions (`jwt_has_role`, `jwt_in_dept`) are `STABLE SECURITY DEFINER`, mirroring `public.has_role` / `public.is_admin` in `0001_rls_policies.sql`, and read the `app_metadata` arrays with the jsonb contains operator `?`.

## Cross-tenant block demonstration

The demonstration is encoded as the reusable integration test (below). The mechanism:

- **Anon / authenticated key (RLS active):** a `parent_profile` SELECT filtered to a *foreign* `user_id` must return either an explicit RLS denial (`row-level security` / `permission denied` / `not authorized`) or an empty set. The owner-only policy `user_id = auth.uid()` cannot match a row owned by someone else, so no foreign row is observable.
- **Service-role key (RLS bypassed):** the identical query must return the foreign row, proving the v1 posture — the policy is correct but the service role sidesteps it, so the live gate is the application layer (`hasPermission`, ADR-002), not RLS.

Asserting both halves is what makes the demonstration honest: it proves the policy is *correct* (anon blocked) AND proves it is *not the v1 enforcement point* (service role bypasses).

## Reusable test pattern

Helper: [`../../../tests/db/_rls-helpers.ts`](../../../tests/db/_rls-helpers.ts). Spec: [`../../../tests/db/rls.spec.ts`](../../../tests/db/rls.spec.ts).

The helper exposes a table-agnostic API so later RLS work (engagement, `fb_sync_link`, ...) reuses it by passing a different table + owner column + foreign owner id:

```ts
type CrossTenantCase = { table: string; ownerColumn: string; otherOwnerId: string };

readRlsTestEnv(): RlsTestEnv | null;                 // null when env unset -> suite skips
assertCrossTenantBlocked(env, testCase): Promise<void>;     // anon path: no foreign rows
assertServiceRoleBypasses(env, testCase): Promise<void>;    // service path: foreign rows visible
```

Env-gating (CI stays green with no live DB):

- `readRlsTestEnv()` returns `null` unless both `SUPABASE_TEST_URL` and `SUPABASE_TEST_ANON_KEY` are set; the anon suite is `describe.skipIf(!liveDbAvailable)`.
- The bypass suite additionally requires `SUPABASE_TEST_SERVICE_ROLE_KEY`; it is `describe.skipIf(!serviceRoleAvailable)`.
- The foreign owner id is read from `SUPABASE_TEST_OTHER_USER_ID` (no identity hardcoded).
- All connection material is read from env only — no secrets in the repo.
- A standing `describe.skipIf(liveDbAvailable)` notice asserts the skip is by design, so the CI run shows an explicit passing "skipped by design" marker rather than silence.

`npm test` result: 26 passed, 4 skipped (the live RLS cases). The suite compiles and skips cleanly with no live DB.

## v1 service-role bypass vs v2 authenticated-key enforcement

This is the load-bearing framing (ADR-019):

| | v1 (current) | v2 (deferred) |
|---|---|---|
| App DB connection | service-role key | authenticated/anon key (per-request JWT) |
| Does this policy enforce? | **No** — service role bypasses RLS | **Yes** — same SQL, now the gate |
| Live authorisation gate | application layer (`hasPermission`, ADR-002) | RLS + application layer (defense in depth) |
| SQL change to flip | none | none (connection strategy only) |
| Status of this policy | correct-but-bypassed (dormant net) | enforcing |

The spike therefore tests the anon path to prove the policy is *correct* (simulating the v2 enforcement path) AND tests the service-role path to confirm v1 *bypass*. **RLS is NOT live in v1.** No claim to the contrary appears in the sample SQL, the test, or this doc.

## Could not execute

The integration suite was **authored and env-gated, not executed against the live SRIAAWP Supabase project.** Reasons (thesis audit trail):

- The `add_rbac_claims` access-token hook is a reviewable draft (spike #11) that is **not yet registered** in the Supabase dashboard, so a live JWT does not yet carry `app_metadata.role_codes` / `dept_ids`. The role/dept predicate cannot be exercised end-to-end until the hook is wired (the #79 cut-over step).
- Running the cross-tenant test requires seeding synthetic identities and a service-role key into the live project, which is out of scope per the spike constraints (do not mutate the live Supabase project, do not run migrations).
- The sample policy is a reference file and was **not applied** to any database; the live policy style it mirrors (`0001`/`0003`) is already in `supabase/migrations/`.

What *is* proven here: the policy reads exactly the `add_rbac_claims` claim shape (cross-referenced field by field); the reusable helper + spec typecheck, lint, and skip cleanly; the full `npm test` and `npm run build` are green. The expected live result is documented (anon blocked, service role bypasses) and the test will assert it the moment the env vars + hook are present.

## Open questions / follow-up

- Promote the sample helpers into the foundation when the v2 authenticated-key path is scheduled; wire `assertCrossTenantBlocked` into engagement and `fb_sync_link` RLS as those tables land.
- The `editor` role code in the sample `news` policy is illustrative; reconcile against the final role catalogue (`roles.code`) before any production news-edit policy ships.
- Live execution is gated on the #79 cut-over registering `add_rbac_claims` and provisioning a test project with seeded fixtures.

## References

- [ADR-018](../00-meta/decision-log.md#adr-018--replace-authjs-v5-with-supabase-auth-for-identity-and-sessions) — Supabase Auth identity; PK reuse so `auth.uid()` = app PK.
- [ADR-019](../00-meta/decision-log.md#adr-019--enforcement-and-revocation-under-supabase-auth) — claim shape (`app_metadata.role_codes/status/dept_ids`); v1 service-role bypass / v2 authenticated-key enforcement split.
- [ADR-002](../00-meta/decision-log.md#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth) — application layer is the source of truth; RLS is defense in depth.
- [`rls-policy-design.md`](../03-design/rls-policy-design.md) notes 2–3 — service-role bypass; public reads served via service-role with no `anon` policy.
- [`supabase-auth/add_rbac_claims.sql`](./supabase-auth/add_rbac_claims.sql) — the claim contract this policy reads.
- [`supabase-rls/sample-policy.sql`](./supabase-rls/sample-policy.sql), [`../../../tests/db/_rls-helpers.ts`](../../../tests/db/_rls-helpers.ts), [`../../../tests/db/rls.spec.ts`](../../../tests/db/rls.spec.ts).
