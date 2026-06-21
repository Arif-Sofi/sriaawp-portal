-- 0010_facebook_sync.sql — one-way OUTBOUND Facebook Page sync (issue #85, ADR-022).
--
-- Hand-authored (NOT drizzle-kit generated): the journal numbering collides with the
-- hand-authored 0001/0003/0004/0005/0007/0008/0009 RLS/DDL files, so this migration is authored by
-- hand with the next sequential number (0010). DDL + RLS live in this one file, mirroring 0009.
-- The drizzle-kit journal (meta/_journal.json) is left UNTOUCHED so `npm run db:check` stays green.
--
-- Scope (ADR-022): v1 publishes ONLY visibility='public' portal news to the school's Facebook Page,
-- behind an Admin per-post opt-in plus a global Admin kill-switch (app_setting.facebook_sync_enabled,
-- seeded false). Inbound (Facebook->portal) and full bidirectional sync are explicitly NOT built.
--
-- Tables added:
--   * fb_sync_link  — projection/state per (news item, direction). content_hash drives dedup +
--     edit-detection; UNIQUE(portal_news_id, direction) gives one outbound link per news item.
--     Delivery itself reuses the existing outbox + idempotency tables (0007) — no parallel queue.
--   * fb_credential — the long-lived Page access token stored pgcrypto-encrypted (bytea) via
--     pgp_sym_encrypt with FACEBOOK_TOKEN_KEY, mirroring the IC-number pattern (ADR-008/ADR-016).
--     Never plaintext, never in .env. The MOCK path never reads or networks this value.
--
-- news gains origin + external_id with UNIQUE(origin, external_id) for loop prevention: a
-- Facebook-originated post can be ingested at most once (inbound is deferred; the columns are added
-- now because they are cheap and make the invariant explicit). external_id is NULL for portal rows;
-- Postgres treats multiple NULLs as distinct, so existing portal rows are unaffected.
--
-- RLS posture (ADR-019): correct-but-bypassed in v1, header mirrors 0009. fb_sync_link and
-- fb_credential are service-role only (no anon/authenticated policy => deny). The Page token in
-- fb_credential must never be reachable by a non-service role.

CREATE TYPE "public"."news_origin" AS ENUM('portal', 'facebook');--> statement-breakpoint
CREATE TYPE "public"."fb_sync_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."fb_sync_status" AS ENUM('pending', 'synced', 'failed');--> statement-breakpoint

ALTER TABLE "news" ADD COLUMN "origin" "news_origin" DEFAULT 'portal' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_origin_external_id_unique" UNIQUE("origin", "external_id");--> statement-breakpoint

CREATE TABLE "fb_sync_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_news_id" uuid NOT NULL,
	"fb_object_id" text,
	"direction" "fb_sync_direction" NOT NULL,
	"content_hash" text NOT NULL,
	"sync_status" "fb_sync_status" DEFAULT 'pending' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fb_sync_link_portal_news_id_direction_unique" UNIQUE("portal_news_id", "direction")
);
--> statement-breakpoint
CREATE TABLE "fb_credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" text,
	"page_token_encrypted" bytea NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "fb_sync_link" ADD CONSTRAINT "fb_sync_link_portal_news_id_news_id_fk" FOREIGN KEY ("portal_news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "fb_sync_link_portal_news_id_idx" ON "fb_sync_link" USING btree ("portal_news_id");--> statement-breakpoint

-- ============================================================================
-- fb_sync_link / fb_credential — service-role only. No anon/authenticated policy
-- => deny all once RLS is on. fb_credential holds the encrypted Page token and
-- must never be reachable outside the service role.
-- ============================================================================
ALTER TABLE "fb_sync_link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fb_credential" ENABLE ROW LEVEL SECURITY;
