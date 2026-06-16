# RBAC Permission Matrix

## Introduction

The SRIAAWP portal enforces access control at two independent layers, as specified in ADR-002. The application layer is the primary and authoritative enforcement point: every server action and server component calls `requirePermission(code)` or `hasPermission(user, code)` before any data operation. Row Level Security (RLS) on Supabase Postgres constitutes a defence-in-depth secondary layer that limits what non-service-role database connections can observe, even if the application layer were bypassed. The service-role key — used exclusively by the Next.js server — bypasses RLS by Supabase design.

The permission model is role-based with optional scope narrowing. Each user is assigned one or more roles; each role carries a set of permission codes defined in `src/db/seed/catalogue.ts`. The application resolves the union of all permissions across all of a user's roles at session hydration time and stores them on the session object. Scope narrowing (`department` scope) is stored in `user_role.scope_type` and `scope_id`, and exposed to calling code as `user.deptIds[]`. The RBAC gate `hasPermission(user, code, { deptId })` rejects calls where the user's scope does not cover the target department.

Audit logging (ADR-008) captures every mutation through `writeAudit` in `src/lib/pdpa/audit.ts`. The `audit_log` table has RLS enabled with no non-service-role policies, so only the service-role server may write or read audit records.

Content visibility for news and memos (ADR-010) follows a three-value taxonomy:

- `public` — readable by unauthenticated visitors and any authenticated user.
- `internal` — readable by any authenticated user; not exposed to the anonymous key.
- `role_list` — readable only by authenticated users whose role set overlaps the `visibility_roles` array on the row.

The application layer enforces this taxonomy in `src/lib/content/queries.ts`. The RLS layer enforces only the `public` / non-public boundary on `news`; `memo` allows any authenticated session; `audit_log` denies all non-service access.

---

## Roles

| Role code | Label | Scope |
|-----------|-------|-------|
| `admin` | Administrator | Global |
| `teacher` | Teacher / staff | Department (scoped to assigned department) |
| `parent` | Parent / guardian | Global |
| `student` | Student | Global |

Teachers receive a `department` scope assignment. Permission checks that include a `deptId` scope parameter will succeed only if the teacher's `deptIds` array contains the target department identifier.

---

## Permission matrix

The columns below correspond to the four role codes. "Yes" indicates the role carries the permission code in `ROLE_PERMISSIONS`. "No" indicates the permission is absent for that role. Scope notes clarify where department-level restrictions apply.

### User management

| Permission code | Label | Admin | Teacher | Parent | Student |
|----------------|-------|-------|---------|--------|---------|
| `user:read:self` | Read own user record | Yes | Yes | Yes | Yes |
| `user:read:dept` | Read users within own department | Yes | Yes (own dept) | No | No |
| `user:read:any` | Read any user record | Yes | No | No | No |
| `user:invite` | Invite a new user | Yes | No | No | No |
| `user:verify_parent` | Approve or reject parent verification requests | Yes | No | No | No |
| `user:link_family` | Create or edit parent-student family links | Yes | No | No | No |
| `user:manage_roles` | Assign or revoke user roles | Yes | No | No | No |

### Role and permission management

| Permission code | Label | Admin | Teacher | Parent | Student |
|----------------|-------|-------|---------|--------|---------|
| `role:manage` | Create or edit role definitions | Yes | No | No | No |
| `permission:manage` | Create or edit permission definitions | Yes | No | No | No |

### Department management

| Permission code | Label | Admin | Teacher | Parent | Student |
|----------------|-------|-------|---------|--------|---------|
| `department:manage` | Create or edit departments | Yes | No | No | No |

### Event management

| Permission code | Label | Admin | Teacher | Parent | Student |
|----------------|-------|-------|---------|--------|---------|
| `event:create` | Create events | Yes | Yes | No | No |
| `event:edit` | Edit events | Yes | Yes | No | No |
| `event:override_conflict` | Override soft conflicts when creating events | Yes | No | No | No |
| `event:cancel` | Cancel events | Yes | Yes | No | No |
| `event:publish` | Publish events to the public Takwim | Yes | No | No | No |

### News

| Permission code | Label | Admin | Teacher | Parent | Student |
|----------------|-------|-------|---------|--------|---------|
| `news:author` | Author and publish news posts | Yes | Yes | No | No |
| `news:read` | Read news posts visible to caller | Yes | Yes | Yes | Yes |

Note: `news:read` is informational. The `listVisibleNews` query applies the visibility taxonomy regardless of whether the caller holds `news:read`. Public news is additionally readable without any authentication.

### Memo

| Permission code | Label | Admin | Teacher | Parent | Student |
|----------------|-------|-------|---------|--------|---------|
| `memo:author` | Author and publish internal memos | Yes | Yes | No | No |
| `memo:read` | Read memos visible to caller | Yes | Yes | Yes | Yes |

Note: `memo:read` is informational. The `listVisibleMemos` query applies the visibility taxonomy. Memos are never readable by unauthenticated visitors.

### Document management

| Permission code | Label | Admin | Teacher | Parent | Student |
|----------------|-------|-------|---------|--------|---------|
| `document:upload` | Upload documents into the RAG corpus | Yes | Yes | No | No |
| `document:edit` | Edit document metadata or replace versions | Yes | Yes | No | No |
| `document:delete` | Delete documents | Yes | No | No | No |
| `document:reindex` | Trigger re-embedding of a document | Yes | Yes | No | No |

### RAG chat

| Permission code | Label | Admin | Teacher | Parent | Student |
|----------------|-------|-------|---------|--------|---------|
| `rag:query` | Use the RAG chat interface | Yes | Yes | Yes | No |

### Co-curricular

| Permission code | Label | Admin | Teacher | Parent | Student |
|----------------|-------|-------|---------|--------|---------|
| `cocurricular:approve_achievement` | Approve student achievement applications | Yes | Yes | No | No |
| `cocurricular:manage_group` | Manage co-curricular groups and enrolments | Yes | Yes | No | No |
| `cocurricular:submit_achievement` | Submit own achievement application | Yes | No | No | Yes |

### Dashboards

| Permission code | Label | Admin | Teacher | Parent | Student |
|----------------|-------|-------|---------|--------|---------|
| `staff:dashboard:read` | Access the staff dashboard landing | Yes | Yes | No | No |
| `admin:dashboard:read` | Access the admin dashboard landing | Yes | No | No | No |

---

## Audit log coverage

Per ADR-008, every write operation that modifies a content resource emits an `audit_log` record via `writeAudit`. The following actions are currently instrumented:

| Action | Resource type | Triggered by |
|--------|---------------|--------------|
| `news.create` | `news` | `createNews` server action |
| `news.update` | `news` | `updateNews` server action |
| `news.publish` | `news` | `publishNews` server action |
| `news.delete` | `news` | `deleteNews` server action |
| `memo.create` | `memo` | `createMemo` server action |
| `memo.update` | `memo` | `updateMemo` server action |
| `memo.delete` | `memo` | `deleteMemo` server action |

Audit records capture `actor_user_id`, `action`, `resource_type`, `resource_id`, and an optional `metadata` jsonb field. The `audit_log` table has RLS enabled with no accessible policies for non-service-role connections; records are write-only from the application server's perspective and are reviewed exclusively through the Supabase service-role console or a dedicated admin query surface (planned for a later PR).
