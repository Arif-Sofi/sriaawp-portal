-- RLS policies — defense-in-depth mirror of the application-layer RBAC matrix (ADR-002).
--
-- Assumptions about the session shape:
--   * `auth.uid()` returns the `users.id` (uuid) of the requester.
--   * The Auth.js v5 session callback (PR #25) populates a JWT claim `roles` (text[]) with
--     the requester's role codes. We read it via `auth.jwt() -> 'roles'`.
--   * Service-role connections bypass RLS by design (Supabase default); the application server
--     uses the service-role key for trusted reads/writes per ADR-002.
--
-- Convention: every policy is `for authenticated using (...) [with check (...)]`.
-- Anonymous reads are explicitly NOT granted — public surfaces (e.g. Takwim) read through
-- the service-role server, not the anon key.

-- Helper: does the session have the given role code?
CREATE OR REPLACE FUNCTION public.has_role(role_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'roles')::jsonb ? role_code,
    false
  );
$$;

-- Helper: is the requester an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role('admin');
$$;

-- ============================================================================
-- users — FR-UM-001/002: a user reads themselves; admin reads anyone.
-- ============================================================================
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_self ON "users"
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY users_update_self ON "users"
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY users_admin_insert ON "users"
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY users_admin_delete ON "users"
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- accounts / sessions / verification_token / authenticators — owner-only.
-- These tables are written by the Auth.js adapter through the service role,
-- but the anon key must never observe another user's tokens or sessions.
-- ============================================================================
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_owner ON "accounts"
  FOR ALL TO authenticated
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_owner ON "sessions"
  FOR ALL TO authenticated
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

ALTER TABLE "verification_token" ENABLE ROW LEVEL SECURITY;
-- verification_token is keyed by identifier (email) + token; only the service role reads.
-- No policies for anon/authenticated => deny all by default once RLS is on.

ALTER TABLE "authenticators" ENABLE ROW LEVEL SECURITY;
CREATE POLICY authenticators_owner ON "authenticators"
  FOR ALL TO authenticated
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

-- ============================================================================
-- roles / permissions / role_permission — readable by any authenticated user;
-- mutable only by admin. Used by the RBAC bootstrap and admin-only role manager.
-- ============================================================================
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_select_all ON "roles" FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_admin_write ON "roles"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_select_all ON "permissions" FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_admin_write ON "permissions"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE "role_permission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permission_select_all ON "role_permission" FOR SELECT TO authenticated USING (true);
CREATE POLICY role_permission_admin_write ON "role_permission"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- user_role — a user reads their own assignments; admin reads/writes any.
-- FR-UM-005 (admin manages user roles).
-- ============================================================================
ALTER TABLE "user_role" ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_role_select_self_or_admin ON "user_role"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY user_role_admin_write ON "user_role"
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY user_role_admin_update ON "user_role"
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY user_role_admin_delete ON "user_role"
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- departments — read for any authenticated user; mutate admin-only.
-- FR-DM-001/002 (department CRUD is an admin task).
-- ============================================================================
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY departments_select_all ON "departments" FOR SELECT TO authenticated USING (true);
CREATE POLICY departments_admin_write ON "departments"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- parent_profile — owner reads/writes their own row; admin reads any.
-- ============================================================================
ALTER TABLE "parent_profile" ENABLE ROW LEVEL SECURITY;

CREATE POLICY parent_profile_select_self_or_admin ON "parent_profile"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY parent_profile_owner_write ON "parent_profile"
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY parent_profile_admin_insert ON "parent_profile"
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY parent_profile_admin_delete ON "parent_profile"
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- staff_profile — owner reads self; admin reads any. Mutations admin-only.
-- ============================================================================
ALTER TABLE "staff_profile" ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_profile_select_self_or_admin ON "staff_profile"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY staff_profile_admin_write ON "staff_profile"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- student_profile — owner reads self; teacher reads dept-scoped students;
-- admin reads any. FR-UM-008 (teacher dept view).
-- For now teacher visibility is global — narrowing to dept_id requires a
-- staff_profile.dept_id lookup which is added once a teacher dept-scope claim
-- lands in the JWT. Tracked in the follow-up RLS-tightening issue.
-- ============================================================================
ALTER TABLE "student_profile" ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_profile_select_self ON "student_profile"
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.has_role('teacher')
    OR EXISTS (
      SELECT 1 FROM "family_link" fl
      WHERE fl.parent_user_id = auth.uid() AND fl.student_user_id = "student_profile".user_id
    )
  );

CREATE POLICY student_profile_admin_write ON "student_profile"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- family_link — visible to either party; mutable only by admin (ADR-011).
-- ============================================================================
ALTER TABLE "family_link" ENABLE ROW LEVEL SECURITY;

CREATE POLICY family_link_select_party_or_admin ON "family_link"
  FOR SELECT TO authenticated
  USING (
    parent_user_id = auth.uid()
    OR student_user_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY family_link_admin_write ON "family_link"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- parent_verification_request — owner reads own; admin reads/updates all (ADR-011).
-- INSERT is allowed by the requester themselves (parent self-registration).
-- ============================================================================
ALTER TABLE "parent_verification_request" ENABLE ROW LEVEL SECURITY;

CREATE POLICY pvr_select_self_or_admin ON "parent_verification_request"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY pvr_self_insert ON "parent_verification_request"
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY pvr_admin_update ON "parent_verification_request"
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY pvr_admin_delete ON "parent_verification_request"
  FOR DELETE TO authenticated
  USING (public.is_admin());
