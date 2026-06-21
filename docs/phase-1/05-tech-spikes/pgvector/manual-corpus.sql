-- ============================================================================
-- REFERENCE SQL — NOT A MIGRATION. DO NOT RUN AGAINST THE LIVE PROJECT.
-- ============================================================================
-- Spike #13 (pgvector + Gemini, ADR-020). This file is reviewable reference
-- only, kept OUT of supabase/migrations/ and out of the drizzle-kit journal,
-- the same approach spikes #11/#12 used. The real document_chunk/embedding
-- tables are issue #26's job (a later migration), which will reconcile the
-- shapes below with the live document/document_version/document_chunk
-- conventions and promote this DDL into the migration runner.
--
-- Scope per ADR-020 (re-baseline of ADR-005/006): the v1 RAG corpus is a
-- SINGLE "how-to-use-this-system" manual of TENS of chunks, NOT the school
-- document set. At that volume an HNSW index (m=16, ef_construction=64,
-- ADR-005) is over-sized; v1 Mode 3 uses a FLAT EXACT sequential cosine scan
-- over the embedding table. HNSW is therefore DEFERRED to the v2 document
-- corpus (see the index note below). No HNSW index is created here.
--
-- Embedding model: text-only gemini-embedding-001 at outputDimensionality=1536
-- (ADR-006). Image links are section METADATA (manual_chunk.image_urls), never
-- embedded.
-- ============================================================================

-- pgvector extension. The live 0000 migration enables pgcrypto and explicitly
-- defers `vector` (ADR-016 consequences); issue #26 promotes this line into a
-- real migration. Idempotent so a re-run is a no-op.
create extension if not exists vector;

-- ----------------------------------------------------------------------------
-- manual_chunk — the chunked "how-to-use-this-system" manual (Mode 3 corpus).
-- ----------------------------------------------------------------------------
-- Mirrors the live document_chunk conventions (0005_documents.sql) so issue #26
-- can reconcile cleanly: uuid PK with gen_random_uuid(), an ordering
-- chunk_index, a text content column, and created_at as timestamptz default
-- now(). It deliberately DIVERGES from document_chunk in three ways, all driven
-- by ADR-020:
--   * No document_id / version_id FKs. The manual is a single logical corpus,
--     not a versioned uploaded file, so there is no document/document_version
--     parent. A section_heading replaces the page_from/page_to provenance.
--   * image_urls text[] — section metadata returned by Mode 3 alongside the
--     grounded text (screenshots of the portal). These are links the embedder
--     never sees; they are NOT pixels and NOT embedded (ADR-006/020).
--   * No acl_keys. document_chunk carries acl_keys for the per-document RBAC
--     pre-filter (master-plan 11.5); the manual is a single uniformly-visible
--     corpus, so v1 has no per-chunk ACL. (Whether a manual section can itself
--     be role-scoped is a v2 question, left open.)
create table if not exists manual_chunk (
	id uuid primary key default gen_random_uuid(),
	section_heading text not null,
	chunk_index integer not null,
	content text not null,
	image_urls text[] not null default '{}',
	token_count integer,
	created_at timestamp with time zone not null default now(),
	constraint manual_chunk_chunk_index_unique unique (chunk_index)
);

-- ----------------------------------------------------------------------------
-- manual_embedding — one embedding row per manual_chunk.
-- ----------------------------------------------------------------------------
-- vector(1536) matches gemini-embedding-001 at outputDimensionality=1536
-- (ADR-006). model is pinned per row so a future model upgrade can run
-- side-by-side; dim is stored redundantly as a guard so a row whose vector
-- length disagrees with its declared dim is detectable. One embedding per
-- chunk in v1 (unique chunk_id).
create table if not exists manual_embedding (
	id uuid primary key default gen_random_uuid(),
	chunk_id uuid not null references manual_chunk (id) on delete cascade,
	model text not null default 'gemini-embedding-001',
	dim integer not null default 1536,
	embedding vector(1536) not null,
	created_at timestamp with time zone not null default now(),
	constraint manual_embedding_chunk_id_unique unique (chunk_id),
	constraint manual_embedding_dim_is_1536 check (dim = 1536)
);

-- ----------------------------------------------------------------------------
-- HNSW index — DEFERRED to v2 (intentionally absent in v1).
-- ----------------------------------------------------------------------------
-- ADR-005 sized an HNSW index (m=16, ef_construction=64) for <=100k document
-- chunks. ADR-020 narrows the v1 corpus to the tens-of-chunks of one manual,
-- where a flat exact sequential cosine scan over manual_embedding is both
-- faster (no approximate-search recall loss) and simpler (no index build,
-- no ef_search tuning) than an approximate index. We therefore create NO
-- vector index in v1; retrieval reads the whole table and ranks by cosine in
-- the application (src/lib/ai/retrieve.ts).
--
-- When the v2 document-RAG corpus lands (issue #26 + the real school document
-- set, post paid-tier + consents per ADR-007/008), add the deferred index, e.g.:
--
--   create index manual_embedding_hnsw
--     on manual_embedding
--     using hnsw (embedding vector_cosine_ops)
--     with (m = 16, ef_construction = 64);
--
-- vector_cosine_ops pairs with the cosine distance operator (<=>); the flat
-- scan in v1 computes the same cosine similarity in application code so the
-- ranking is identical when the index is later introduced.
