-- Sample RLS policy for SPIKE #12 (ADR-018 / ADR-019). REVIEWABLE REFERENCE ONLY.
-- NOT applied by the migration runner: this file lives outside supabase/migrations/
-- on purpose so the drizzle-kit journal does not pick it up (same approach the
-- add_rbac_claims hook draft used for spike #11). The live policy style lives in
-- supabase/migrations/0001_rls_policies.sql and 0003_content_rls.sql; this file
-- only demonstrates the two predicate shapes the spike must prove against the
-- add_rbac_claims claim contract.
--
-- POSTURE (ADR-019, identical to 0003_content_rls.sql's header):
--   Service-role connections bypass RLS by design (Supabase default). v1 keeps
--   the service-role connection, so these policies are CORRECT-BUT-BYPASSED -- a
--   dormant defense-in-depth net. The live v1 gate is the application layer
--   (hasPermission, ADR-002). The authenticated-key path that actually ENFORCES
--   these policies is deferred to v2; no SQL change is needed when it lands.
--   Do NOT read this file as "RLS is now live".
--
-- CLAIM CONTRACT (shared with docs/phase-1/05-tech-spikes/supabase-auth/add_rbac_claims.sql):
--   auth.uid()                                  -> the requester's users.id (uuid);
--                                                  the app PK is reused as auth.users.id
--                                                  (ADR-018), so FK ownership maps onto it.
--   auth.jwt() -> 'app_metadata' -> 'role_codes' -> jsonb array of role codes (text[])
--   auth.jwt() -> 'app_metadata' -> 'dept_ids'   -> jsonb array of department ids (text[])
--   NOTE the claims live in app_metadata, NOT user_metadata (ADR-019): app_metadata
--   is server-controlled and cannot be edited by the user, so it is safe to trust.

-- ============================================================================
-- Helpers reading the add_rbac_claims app_metadata shape.
-- STABLE SECURITY DEFINER so policies can call them without per-call grants,
-- mirroring public.has_role / public.is_admin in 0001_rls_policies.sql.
-- ============================================================================

-- Does the JWT carry the given role code in app_metadata.role_codes?
CREATE OR REPLACE FUNCTION public.jwt_has_role(role_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'role_codes') ? role_code,
    false
  );
$$;

-- Is the given department id present in app_metadata.dept_ids?
-- dept_ids is emitted by add_rbac_claims as text (uuid::text), so the policy
-- compares against dept_id::text.
CREATE OR REPLACE FUNCTION public.jwt_in_dept(dept_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'dept_ids') ? dept_id,
    false
  );
$$;

-- ============================================================================
-- (a) OWNERSHIP predicate: auth.uid() = parent_profile.user_id
-- A parent reads/writes only their own row. parent_profile.user_id is the PK
-- and equals auth.uid() under ADR-018 (PK reuse), so the check is a direct FK
-- comparison with no lookup. This is the canonical per-user-row pattern that
-- assertCrossTenantBlocked exercises (tests/db/_rls-helpers.ts).
-- ============================================================================
ALTER TABLE "parent_profile" ENABLE ROW LEVEL SECURITY;

CREATE POLICY sample_parent_profile_owner_select ON "parent_profile"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY sample_parent_profile_owner_write ON "parent_profile"
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- (b) ROLE / DEPT predicate: reads app_metadata.role_codes + app_metadata.dept_ids
-- A staff member edits a news item when they authored it, OR they hold the
-- 'editor' role for the item's department. This combines the ownership column
-- (author_user_id) with the two claim-based checks the spike must prove.
-- ============================================================================
ALTER TABLE "news" ENABLE ROW LEVEL SECURITY;

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
  WITH CHECK (
    author_user_id = auth.uid()
    OR (
      public.jwt_has_role('editor')
      AND dept_id IS NOT NULL
      AND public.jwt_in_dept(dept_id::text)
    )
  );
