-- 0009_engagement.sql — news engagement surface (issue #82, ADR-021).
--
-- Hand-authored (NOT drizzle-kit generated): the journal numbering collides with the
-- hand-authored 0001/0003/0004/0005/0007/0008 RLS/DDL files, so this migration is authored by
-- hand with the next sequential number (0009). DDL + the one-level trigger + RLS live in this
-- one file, mirroring 0008 + 0003. The drizzle-kit journal (meta/_journal.json) is left
-- untouched so `npm run db:check` stays green.
--
-- Scope (ADR-021, revising ADR-010): three engagement child tables under the Information Center
-- domain — news_reaction (like-only), news_comment (one-level thread), notification — plus a
-- generic app_setting table for the allow_student_comments toggle (#87). The child rows carry
-- NO visibility column; they INHERIT the parent news item's {public, internal, role_list} scope
-- by FK join. The existing audit_log (0002) is UNCHANGED: engagement mutations log through the
-- existing writeAudit path with resourceType 'news_comment' / 'news_reaction' (wired in #83).
--
-- PDPA — DSAR anonymise-on-erasure (ADR-008): news_reaction.user_id and
-- news_comment.author_user_id are ON DELETE SET NULL so an erasure nulls the actor and the
-- thread structure survives (a teacher's answer is not orphaned by erasure of the asking parent).
-- NULLABILITY NOTE: ADR-021 lists news_reaction.user_id as conceptually NOT NULL, but a NOT NULL
-- column cannot be SET NULL on erasure. The column is therefore NULLABLE; an orphaned reaction is
-- pruned by the application, not the FK. (news_comment.author_user_id is already NULLABLE.)
--
-- ONE-LEVEL THREAD ENFORCEMENT: a column CHECK cannot reference another row, so the single
-- permitted reply depth is enforced by a BEFORE INSERT OR UPDATE trigger that REJECTS a row whose
-- parent_comment_id points at a comment that itself has a non-null parent_comment_id.
--
-- RLS posture (ADR-019): correct-but-bypassed in v1, header mirrors 0003. Service-role
-- connections bypass RLS by design (Supabase default); v1 keeps the service-role connection, so
-- these policies are a dormant defense-in-depth net. The live v1 gate is the application layer
-- (src/lib/content/queries.ts visibility logic; ADR-002). The authenticated-key path that
-- actually ENFORCES these policies is deferred to v2; no SQL change is needed when it lands.
-- The SELECT policies mirror listVisibleNews via a subquery against the parent news row.
-- Mutations are service-role only (no mutation policy = deny for non-service roles), matching
-- 0003. The cross-visibility ATTACK TEST (R-04) is owned by the UI/server-action issue #83.

CREATE TYPE "public"."reaction_type" AS ENUM('like');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('visible', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('news_comment_received', 'news_comment_answered');--> statement-breakpoint

CREATE TABLE "news_reaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"news_id" uuid NOT NULL,
	"user_id" uuid,
	"reaction_type" "reaction_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_reaction_news_id_user_id_reaction_type_unique" UNIQUE("news_id", "user_id", "reaction_type")
);
--> statement-breakpoint
CREATE TABLE "news_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"news_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"author_user_id" uuid,
	"body" text NOT NULL,
	"status" "comment_status" DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "news_reaction" ADD CONSTRAINT "news_reaction_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_reaction" ADD CONSTRAINT "news_reaction_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_comment" ADD CONSTRAINT "news_comment_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_comment" ADD CONSTRAINT "news_comment_parent_comment_id_news_comment_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."news_comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_comment" ADD CONSTRAINT "news_comment_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_setting" ADD CONSTRAINT "app_setting_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "news_reaction_news_id_idx" ON "news_reaction" USING btree ("news_id");--> statement-breakpoint
CREATE INDEX "news_comment_news_id_idx" ON "news_comment" USING btree ("news_id");--> statement-breakpoint
CREATE INDEX "news_comment_parent_comment_id_idx" ON "news_comment" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "notification_recipient_user_id_idx" ON "notification" USING btree ("recipient_user_id");--> statement-breakpoint

-- ============================================================================
-- One-level thread enforcement. A column CHECK cannot inspect the referenced
-- parent row, so reject any comment whose parent is itself a reply (its own
-- parent_comment_id is non-null). This permits exactly one reply level:
-- top-level question -> single teacher answer.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_one_level_comment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  grandparent_id uuid;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT parent_comment_id INTO grandparent_id
  FROM public.news_comment
  WHERE id = NEW.parent_comment_id;

  IF grandparent_id IS NOT NULL THEN
    RAISE EXCEPTION 'news_comment supports only one reply level: parent % is already a reply', NEW.parent_comment_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER news_comment_one_level
  BEFORE INSERT OR UPDATE ON public.news_comment
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_one_level_comment();
--> statement-breakpoint

-- ============================================================================
-- news_reaction — readable iff the parent news item is visible to the caller.
-- The subquery mirrors listVisibleNews (src/lib/content/queries.ts):
--   public   => published rows readable by anyone
--   internal => any authenticated caller
--   role_list => caller role overlaps news.visibility_roles
-- Mutations via service role only (no mutation policy = deny for non-service).
-- ============================================================================
ALTER TABLE "news_reaction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY news_reaction_select_parent_visible ON "news_reaction"
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "news" n
      WHERE n.id = news_reaction.news_id
        AND (
          (n.visibility = 'public' AND n.published_at IS NOT NULL)
          OR (n.visibility = 'internal' AND auth.role() = 'authenticated')
          OR (
            n.visibility = 'role_list'
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(
                COALESCE(auth.jwt() -> 'app_metadata' -> 'role_codes', '[]'::jsonb)
              ) AS rc(code)
              WHERE rc.code = ANY(n.visibility_roles)
            )
          )
        )
    )
  );

-- ============================================================================
-- news_comment — same inherited-visibility SELECT predicate as news_reaction.
-- Mutations via service role only.
-- ============================================================================
ALTER TABLE "news_comment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY news_comment_select_parent_visible ON "news_comment"
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "news" n
      WHERE n.id = news_comment.news_id
        AND (
          (n.visibility = 'public' AND n.published_at IS NOT NULL)
          OR (n.visibility = 'internal' AND auth.role() = 'authenticated')
          OR (
            n.visibility = 'role_list'
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(
                COALESCE(auth.jwt() -> 'app_metadata' -> 'role_codes', '[]'::jsonb)
              ) AS rc(code)
              WHERE rc.code = ANY(n.visibility_roles)
            )
          )
        )
    )
  );

-- ============================================================================
-- notification — a recipient reads only their own notifications.
-- auth.uid() is the requester's users.id (PK reused as auth.users.id, ADR-018).
-- Mutations via service role only.
-- ============================================================================
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_select_own ON "notification"
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

-- ============================================================================
-- app_setting — admin-configurable settings; read/write via service role only
-- (no policy = deny for non-service roles). The app layer gates admin access.
-- ============================================================================
ALTER TABLE "app_setting" ENABLE ROW LEVEL SECURITY;
