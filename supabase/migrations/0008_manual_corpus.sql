-- 0008_manual_corpus.sql — Mode 3 manual RAG corpus (issue #26, re-baselined by ADR-020).
--
-- Hand-authored (NOT drizzle-kit generated): the journal numbering collides with the
-- hand-authored 0001/0003/0004/0005/0007 RLS/DDL files, so this migration is authored by
-- hand with the next sequential number (0008). 0006 is reserved for the auth cut-over (#79);
-- 0007 is the operational tables. DDL + RLS live in this one file, mirroring 0007 + 0003.
-- The drizzle-kit journal (meta/_journal.json) is left untouched so `npm run db:check` stays green.
--
-- Scope (ADR-020, re-baseline of ADR-005/006): the v1 RAG corpus is the SINGLE
-- "how-to-use-this-system" MANUAL (Mode 3 only), of TENS of chunks — NOT the school document
-- set. The document/document_version/document_chunk tables (0005, FR-DM Document Management and
-- a v2 document-RAG corpus) are LEFT UNCHANGED; this migration adds the separate manual corpus.
--
-- Reconciliation with document_chunk (0005), per the #26 ticket:
--   Deliberate divergences (ADR-020):
--     * No document_id / version_id FKs — the manual is a single logical corpus, not a versioned
--       uploaded file, so there is no document/document_version parent. section_heading +
--       chunk_index replace the page_from/page_to + parent-id provenance.
--     * image_urls text[] — Mode-3 section image-link metadata returned alongside the grounded
--       text. LINKS only: the embedder never sees them, they are NOT pixels and NOT embedded
--       (ADR-006/020). Where the bytes physically live is Q19/#89 (in-stack candidate: a Supabase
--       Storage public/internal bucket split); this corpus stores only the links.
--     * No acl_keys — document_chunk carries acl_keys for the per-document RBAC pre-filter; the
--       manual is a single uniformly-visible corpus, so v1 has no per-chunk ACL.
--     * Separate manual_embedding table with a per-row `model` (vs no embedding column on
--       document_chunk at all in 0005, which predates pgvector).
--   Shared conventions kept identical so a future v2 document-RAG corpus reconciles cleanly:
--     uuid PK + gen_random_uuid(), chunk_index ordering, text content, created_at timestamptz now().
--   The `embedding` / `document_chunk` naming in the original (pre-re-baseline) #26 body is
--   superseded by manual_embedding / manual_chunk.
--
-- RLS posture (ADR-019): correct-but-bypassed in v1, header mirrors 0003. The service-role
-- connection bypasses RLS by design (Supabase default); the application layer is the live gate.
-- The manual is uniformly visible to authenticated non-anonymous readers, so a simple
-- authenticated-read SELECT policy is sufficient (no per-chunk ACL). Mutations service-role only.
-- These policies become enforcing on the v2 authenticated-key path with no SQL change.

-- pgvector extension. The live 0000 migration enables pgcrypto and explicitly defers `vector`;
-- this migration promotes it. Idempotent so a re-run is a no-op. (0005 predates pgvector and has
-- no embedding column, so this is the first migration to require the extension.)
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "manual_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_heading" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"image_urls" text[] DEFAULT '{}' NOT NULL,
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_chunk_chunk_index_unique" UNIQUE("chunk_index")
);
--> statement-breakpoint
CREATE TABLE "manual_embedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chunk_id" uuid NOT NULL,
	"model" text DEFAULT 'gemini-embedding-001' NOT NULL,
	"dim" integer DEFAULT 1536 NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_embedding_chunk_id_unique" UNIQUE("chunk_id"),
	CONSTRAINT "manual_embedding_dim_is_1536" CHECK ("dim" = 1536)
);
--> statement-breakpoint
ALTER TABLE "manual_embedding" ADD CONSTRAINT "manual_embedding_chunk_id_manual_chunk_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."manual_chunk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- HNSW index — DEFERRED to the v2 document corpus (ADR-020/005), intentionally absent in v1.
-- At tens of chunks an HNSW index (m=16, ef_construction=64) is over-sized; v1 Mode 3 uses a
-- flat exact sequential cosine scan over manual_embedding in the application
-- (src/lib/ai/retrieve.ts). When the v2 document-RAG corpus lands, add the deferred index, e.g.:
--   CREATE INDEX manual_embedding_hnsw ON manual_embedding
--     USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- vector_cosine_ops pairs with the cosine distance operator (<=>); the flat scan computes the
-- same cosine similarity in application code, so the ranking is identical when the index lands.

-- ============================================================================
-- manual_chunk — uniformly visible to any authenticated user (single corpus, no
-- per-chunk ACL). Mutations via service role only.
-- ============================================================================
ALTER TABLE "manual_chunk" ENABLE ROW LEVEL SECURITY;

CREATE POLICY manual_chunk_select_authenticated ON "manual_chunk"
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- manual_embedding — same uniform authenticated-read posture as manual_chunk.
-- Mutations via service role only.
-- ============================================================================
ALTER TABLE "manual_embedding" ENABLE ROW LEVEL SECURITY;

CREATE POLICY manual_embedding_select_authenticated ON "manual_embedding"
  FOR SELECT TO authenticated
  USING (true);
