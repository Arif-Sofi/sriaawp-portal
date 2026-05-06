# RLS policy design

> Defense-in-depth Row Level Security policies on the SRIAAWP Portal database. The application layer remains the source of truth for RBAC ([ADR-002](../00-meta/decision-log.md)); RLS mirrors the matrix at the storage tier so that any direct connection through the Supabase anon key cannot bypass the rules.
>
> **Source.** `supabase/migrations/0001_rls_policies.sql`. **Scope.** PR #24 covers the foundation tables (auth, RBAC, profiles, departments, parent verification). Feature-table policies (events, documents, embeddings, etc.) ship with their respective schema PRs.

---

## Session shape contract

The PostgREST + Auth.js v5 integration assumes:

- `auth.uid()` returns the requester's `users.id` (uuid). Driven by the JWT subject claim populated in the Auth.js session callback (lands in PR #25).
- `auth.jwt() -> 'roles'` is a JSON array of role codes (strings). The session callback projects assigned role codes into the JWT for ergonomic policy expression.
- The service-role key bypasses RLS by Supabase default; trusted server-side code (Server Actions, Route Handlers, the seed) connects through the service role and is responsible for app-layer permission checks per ADR-002.

Two helper functions reduce policy boilerplate:

```sql
public.has_role(role_code text) -> boolean        -- jsonb-contains check
public.is_admin() -> boolean                       -- has_role('admin')
```

Both are `STABLE SECURITY DEFINER` so they can be invoked from policies without per-call grants.

---

## Policy table

| Table | SELECT | INSERT / UPDATE / DELETE | FR / use case |
|-------|--------|--------------------------|---------------|
| `users` | self **or** admin | admin only | FR-UM-001 user reads own profile; FR-UM-002 admin manages users. |
| `accounts` | owner only | owner only | OAuth tokens never leak across users. |
| `sessions` | owner only | owner only | DB session cookie isolation (ADR-003). |
| `verification_token` | (none) | (none) | Service-role only; magic-link flow runs through trusted server. |
| `authenticators` | owner only | owner only | WebAuthn key isolation. |
| `roles`, `permissions`, `role_permission` | any authenticated | admin only | RBAC catalogue is readable so the UI can render role pickers; mutations are admin-gated (FR-UM-005). |
| `user_role` | self or admin | admin only | Self-discovery of own assignments; admin manages all. |
| `departments` | any authenticated | admin only | Department picker; FR-DM-001 admin CRUD. |
| `parent_profile` | self or admin | self updates own; admin all | FR-UM-006 parent edits own contact info. |
| `staff_profile` | self or admin | admin only | Employee number / dept assignment is HR-controlled. |
| `student_profile` | self **or** admin **or** any teacher **or** linked parent | admin only | FR-UM-008 staff dept-view (currently teacher-global; tightened once teacher dept-claim lands in JWT — tracked as follow-up). Linked parent can read their child via `family_link`. |
| `family_link` | parent or student in row, or admin | admin only | ADR-011: parent ↔ student linking is admin-controlled. |
| `parent_verification_request` | self or admin | self can INSERT; admin can UPDATE / DELETE | ADR-011 / P0-Q9 parent self-registration approval flow. |

---

## Notes and known gaps

1. **Teacher dept-scope on student_profile is wider than the target.** The current policy grants any user with role `teacher` global SELECT on `student_profile`. The target is dept-scoped: a teacher in `Curriculum` reads only students whose dept is `Curriculum`. Tightening this requires either (a) a JWT claim listing the teacher's department UUIDs, or (b) a `staff_profile` lookup inside the policy. Option (a) is cheaper at query time. Tracked as a follow-up issue alongside the session-callback work in PR #25.

2. **Anonymous / public reads.** No policy grants `anon` access. Public surfaces (the public Takwim, public news) are served by the trusted server through the service-role key; the anon key is for authenticated-user reads only. This avoids a class of "policy-disabled-by-mistake" bugs.

3. **Service-role bypass.** Supabase always bypasses RLS for the service role. Every server action / route handler must therefore perform an explicit `hasPermission(user, code)` check before the DB call (ADR-002). This is the application-layer source of truth; RLS is the safety net.

4. **Drift detection.** A periodic audit script (Phase-2 follow-up; tracked in `learning-checklist.md`) will diff the live policies against this design doc and the RBAC matrix, failing CI on drift.

---

## References

- [ADR-002](../00-meta/decision-log.md) — Application layer is the source of truth for RBAC; RLS is defense-in-depth.
- [ADR-008](../00-meta/decision-log.md) — PDPA-aligned design; column-encrypted IC numbers.
- [ADR-011](../00-meta/decision-log.md) — Admin-only parent ↔ student linking.
- [ADR-016](../00-meta/decision-log.md) — Drizzle ORM + drizzle-kit + manual SQL for RLS.
- Master plan — [`../00-master-plan.md`](../00-master-plan.md) §11.2 (RBAC matrix).
- Generated migration — `supabase/migrations/0000_auth_rbac_profiles.sql`.
- Policies — `supabase/migrations/0001_rls_policies.sql`.
