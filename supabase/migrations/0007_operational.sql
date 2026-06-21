-- 0007_operational.sql — cross-cutting operational tables (issue #28, re-baselined).
--
-- Hand-authored (NOT drizzle-kit generated): the journal numbering collides with the
-- hand-authored 0001/0003/0004/0005 RLS/DDL files, so this migration is authored by hand
-- with the next sequential number (0007). 0006 is reserved for the auth cut-over (#79).
-- DDL and RLS live in this one file because it is hand-authored, mirroring 0002 + 0003.
--
-- Tables added: chat_session, chat_message, retrieval_log, outbox, idempotency.
--   chat_message gains the ADR-020 mode discriminator + nullable news_id FK.
--   retrieval_log is generalised (ADR-020) to model EITHER a Mode-3 vector retrieval
--     (chunk_ids/scores) OR a Mode-2 get_news tool-call trace (tool_filters/result_ids),
--     discriminated by `kind`; the vector and get_news column groups are mutually nullable.
--
-- audit_log is NOT touched here: it shipped in 0002 (DDL) + 0003 (RLS) and is unchanged.
--
-- Cross-links (do NOT duplicate the shared contract here):
--   * outbox is the transactional dispatcher reused by `notification` (ADR-021, issue #82) —
--     design them together; do not build a parallel notification queue.
--   * outbox + idempotency back the at-least-once, public-only Facebook egress and the
--     `fb_sync_link` table (ADR-022, issue #85).
--
-- RLS posture (ADR-019): correct-but-bypassed in v1. The service-role connection bypasses RLS
-- by design (Supabase default); the application layer is the live gate. These policies become
-- enforcing on the v2 authenticated-key path with no SQL change. `auth.uid()` returns users.id.

CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."chat_mode" AS ENUM('in_article', 'get_news', 'manual_rag');--> statement-breakpoint
CREATE TYPE "public"."retrieval_kind" AS ENUM('vector', 'get_news');--> statement-breakpoint
CREATE TABLE "chat_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"mode" "chat_mode",
	"news_id" uuid,
	"citations" jsonb,
	"latency_ms" integer,
	"refused_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retrieval_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "retrieval_kind" NOT NULL,
	"query_text" text,
	"chunk_ids" uuid[],
	"scores" real[],
	"tool_filters" jsonb,
	"result_ids" uuid[],
	"model" text,
	"latency_ms" integer,
	"refused_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "idempotency" (
	"key" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"response" jsonb,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_session" ADD CONSTRAINT "chat_session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_session_id_chat_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_log" ADD CONSTRAINT "retrieval_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_session_user_id_idx" ON "chat_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_message_session_id_idx" ON "chat_message" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "retrieval_log_user_id_idx" ON "retrieval_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "outbox_dispatched_at_idx" ON "outbox" USING btree ("dispatched_at");--> statement-breakpoint

-- ============================================================================
-- chat_session — a user may read only their own sessions. Mutations service-role only.
-- ============================================================================
ALTER TABLE "chat_session" ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_session_select_self ON "chat_session"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- chat_message — a user may read only messages in their own sessions
-- (ownership resolved via the parent chat_session). Mutations service-role only.
-- ============================================================================
ALTER TABLE "chat_message" ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_message_select_self ON "chat_message"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "chat_session" cs
      WHERE cs.id = "chat_message".session_id AND cs.user_id = auth.uid()
    )
  );

-- ============================================================================
-- retrieval_log — admin-only SELECT (mirrors the admin-only audit read posture).
-- Inserts via service role only.
-- ============================================================================
ALTER TABLE "retrieval_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY retrieval_log_select_admin ON "retrieval_log"
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- outbox / idempotency — service-role only. No anon/authenticated policy =>
-- deny all once RLS is on. These are internal dispatcher tables.
-- ============================================================================
ALTER TABLE "outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency" ENABLE ROW LEVEL SECURITY;
