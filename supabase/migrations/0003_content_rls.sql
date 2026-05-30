-- RLS policies for news, memo, audit_log (ADR-002 defense-in-depth).
--
-- Service-role connections bypass RLS by design (Supabase default).
-- The application server uses the service-role key for trusted reads/writes.
-- These policies mirror the app-layer visibility model:
--   public => anon + authenticated can read published rows
--   internal / role_list => authenticated only (app layer enforces further)
--   audit_log => no select/insert for non-service roles (deny all)

-- ============================================================================
-- news — public rows readable by anyone; all mutations via service role only.
-- ============================================================================
ALTER TABLE "news" ENABLE ROW LEVEL SECURITY;

CREATE POLICY news_select_public ON "news"
  FOR SELECT TO anon, authenticated
  USING (visibility = 'public' AND published_at IS NOT NULL);

-- ============================================================================
-- memo — readable by any authenticated user; app layer restricts further by
-- visibility = 'internal' or role_list. Mutations via service role only.
-- ============================================================================
ALTER TABLE "memo" ENABLE ROW LEVEL SECURITY;

CREATE POLICY memo_select_authenticated ON "memo"
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- audit_log — no select or insert policy for non-service roles (deny all).
-- Only the service role may read or write audit records.
-- ============================================================================
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
