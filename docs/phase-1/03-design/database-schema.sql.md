# Database schema (DDL prose)

> Authoritative DDL for the SRIAAWP Portal foundation tables. The Drizzle schema in `src/db/schema/` is the source of truth; the SQL prose below is the rendered, human-readable view of the same definitions and is used to brief reviewers, examiners, and the thesis appendix.
>
> **Scope of this PR.** Only the Auth.js v5 adapter tables, RBAC tables, profile tables, departments, and the parent verification request table. Feature-domain tables (events, news, memos, documents, document chunks, embeddings, RAG operational tables, co-curricular tables) are deferred — see [§ Deferred tables](#deferred-tables).
>
> **Status.** Drafted alongside PR #24. Generated migration: `supabase/migrations/0000_auth_rbac_profiles.sql`. RLS policies: `supabase/migrations/0001_rls_policies.sql`.

---

## Postgres extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;        -- gen_random_uuid(), pgp_sym_encrypt()
-- Deferred to a later PR (RAG corpus tables):
-- CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector for embeddings, ADR-005/006
-- CREATE EXTENSION IF NOT EXISTS btree_gist;   -- tstzrange exclusion for room conflict, §11.6
```

---

## Conventions

- IDs: `uuid` with `default gen_random_uuid()` (pgcrypto).
- Timestamps: `timestamp with time zone NOT NULL DEFAULT now()` for `created_at` / `updated_at`. The `updated_at` column is bumped explicitly by every mutation in the application layer; no DB triggers in v1 (revisit if drift is observed during FYP2).
- Casing: snake_case for column names; the Drizzle config has `casing: "snake_case"` so JS identifiers like `parentUserId` map to `parent_user_id` in DDL.
- Auth.js adapter columns keep their adapter-canonical camelCase names (`userId`, `sessionToken`, `emailVerified`, etc.) so the upstream `@auth/drizzle-adapter` runs without a custom mapper.
- IC numbers: stored encrypted as `bytea` via `pgcrypto.pgp_sym_encrypt(plaintext, IC_ENCRYPTION_KEY)` (ADR-008). The plaintext is never persisted; only the application layer holds it transiently for verification.

---

## 1. Auth.js v5 adapter tables

`@auth/drizzle-adapter` (Postgres dialect) ships its own canonical schema. We override the table definitions to use uuid IDs and explicit `created_at` / `updated_at` columns on `users`, while keeping every column name the adapter expects.

### users

| column          | type                       | constraints                          | notes |
|-----------------|----------------------------|--------------------------------------|-------|
| id              | uuid                       | PK, default `gen_random_uuid()`      | Auth.js consumes as text; postgres parses uuid from text. |
| name            | text                       | nullable                             | |
| email           | text                       | nullable, UNIQUE                     | nullable per Auth.js adapter contract; populated for password / OAuth signups. |
| emailVerified   | timestamptz                | nullable                             | adapter writes on verification. |
| image           | text                       | nullable                             | |
| created_at      | timestamptz                | NOT NULL, default `now()`            | |
| updated_at      | timestamptz                | NOT NULL, default `now()`            | bumped by app layer on mutation. |

### accounts

OAuth / credential provider linkage. Composite PK `(provider, providerAccountId)`. FK `userId → users.id ON DELETE CASCADE`. Token columns left nullable per adapter contract.

### sessions

DB-backed session strategy per ADR-003. PK on `sessionToken`. FK `userId → users.id ON DELETE CASCADE`. `expires` is a NOT NULL timestamptz; cleanup of expired rows is a scheduled job (Phase-2 follow-up).

### verification_token

Composite PK `(identifier, token)`. Used for magic-link / email verification flows.

### authenticators

WebAuthn / passkey support per the upstream adapter contract. Defined for forward compatibility; not used by the MVP login flow.

---

## 2. RBAC

### roles

| column     | type        | constraints                       |
|------------|-------------|-----------------------------------|
| id         | uuid        | PK, default `gen_random_uuid()`   |
| code       | text        | UNIQUE NOT NULL                   |
| label      | text        | NOT NULL                          |
| created_at | timestamptz | NOT NULL, default `now()`         |

Seed codes: `admin`, `teacher`, `parent`, `student`.

### permissions

Same shape as `roles` but per-permission. Seeded with the canonical catalogue (28 codes; see [`02-requirements/rbac-matrix.md`](../02-requirements/rbac-matrix.md) when authored). Examples: `event:create`, `document:upload`, `rag:query`, `cocurricular:approve_achievement`.

### role_permission

Composite PK `(role_id, permission_id)`. Both FKs cascade on delete.

### user_role

Composite PK `(user_id, role_id, scope_type, scope_id)` to support role × scope assignment per ADR-002 (e.g. `Teacher.dept_id`).

| column     | type                   | constraints                                                |
|------------|------------------------|------------------------------------------------------------|
| user_id    | uuid                   | NOT NULL, FK `users.id` ON DELETE CASCADE                  |
| role_id    | uuid                   | NOT NULL, FK `roles.id` ON DELETE CASCADE                  |
| scope_type | enum `scope_type`      | NOT NULL, default `'global'`. Values: `global`, `department`. |
| scope_id   | uuid                   | NOT NULL, default `'00000000-0000-0000-0000-000000000000'` (sentinel for global scope) |
| created_at | timestamptz            | NOT NULL, default `now()`                                  |

`scope_id` is non-nullable to allow inclusion in the primary key. The all-zero sentinel UUID stands for "global scope". Per-department assignments populate `scope_id` with the department UUID.

---

## 3. Profiles and family

### parent_profile, staff_profile, student_profile

One-to-one with `users` keyed on `user_id` (PK + FK). `staff_profile.dept_id` is a FK to `departments.id ON DELETE SET NULL`. `student_profile.ic_no_encrypted` is `bytea` (column-encrypted via `pgp_sym_encrypt`, ADR-008).

`student_profile.student_no` and `staff_profile.employee_no` are UNIQUE non-null text identifiers (school-issued natural keys).

### family_link

Composite PK `(parent_user_id, student_user_id)`. Both FKs cascade. Enum `relationship` ∈ {`father`, `mother`, `guardian`}. `primary_contact` boolean tracks the family's designated escalation contact (ADR-011).

### departments

Standard `id / code / name / active / timestamps` shape. `code` is UNIQUE (e.g. `curriculum`, `tahfiz`).

### parent_verification_request

Captures the parent self-registration → admin approval flow per ADR-011 / P0-Q9.

| column                | type                       | notes                                          |
|-----------------------|----------------------------|------------------------------------------------|
| id                    | uuid                       | PK                                             |
| user_id               | uuid                       | FK `users.id` ON DELETE CASCADE                |
| student_ic_provided   | text                       | the IC the parent claims belongs to their child; NEVER persisted in plain text once approved — copied into `student_profile.ic_no_encrypted` and zeroed here in the same transaction. (Copy-and-zero step is implemented in the admin approval action — out of scope for this PR.) |
| status                | enum `verification_status` | `pending` / `approved` / `rejected`            |
| reviewer_user_id      | uuid                       | FK `users.id` ON DELETE SET NULL               |
| reviewed_at           | timestamptz                | nullable                                       |
| notes                 | text                       | reviewer's free-form note                      |
| created_at            | timestamptz                | NOT NULL, default `now()`                      |

---

## Deferred tables

The following tables are out of scope for PR #24 and are tracked as separate issues:

- **Information Center** (FR-IC): `event`, `event_occurrence`, `event_audience`, `room`, `blackout_window`, `news`, `memo`.
- **Document Management** (FR-DM): `document`, `document_version`, `document_chunk`, `embedding (vector(1536))` per ADR-006.
- **Co-curricular** (FR-CR): `cocurricular_group`, `enrolment`, `achievement_application`.
- **RAG operational**: `chat_session`, `chat_message`, `retrieval_log`.
- **Cross-cutting**: `audit_log`, `outbox`, `idempotency`.

Each row above has its own GH issue opened against `Arif-Sofi/sriaawp-portal` and citing PR #24 as the upstream.

---

## References

- Generated migration — `supabase/migrations/0000_auth_rbac_profiles.sql`.
- RLS policies — `supabase/migrations/0001_rls_policies.sql` and [`rls-policy-design.md`](rls-policy-design.md).
- ADRs — [ADR-002](../00-meta/decision-log.md), [ADR-003](../00-meta/decision-log.md), [ADR-005](../00-meta/decision-log.md), [ADR-006](../00-meta/decision-log.md), [ADR-008](../00-meta/decision-log.md), [ADR-011](../00-meta/decision-log.md), [ADR-016](../00-meta/decision-log.md).
- Master plan — [`../00-master-plan.md`](../00-master-plan.md) §11.2 (RBAC matrix), §C row `data-model-erd.md` (full entity list).
