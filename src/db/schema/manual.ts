import {
  check,
  customType,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// pgvector has no native Drizzle type; mirror the bytea customType pattern in
// documents.ts. Dimensionality is pinned to 1536 (gemini-embedding-001, ADR-006).
// The hand-authored migration 0008 is the runtime source for the column; this
// type lets the embedding table stay in the Drizzle schema (ADR-016) without a
// separate SQL-only carve-out. db:check is unaffected: the journal predates
// pgvector and tracks only 0000/0002 snapshots, which this file does not touch.
const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
});

// The single how-to-use-the-system manual corpus (Mode 3, ADR-020). Deliberately
// diverges from document_chunk (0005): no document_id/version_id parent, adds
// image_urls section metadata, drops per-chunk acl_keys (uniformly-visible corpus).
export const manualChunk = pgTable(
  "manual_chunk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionHeading: text("section_heading").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    // Mode-3 section image-link metadata: LINKS only, never embedded (ADR-006/020).
    // The bytes live wherever Q19/#89 decides (in-stack candidate: a Supabase
    // Storage public/internal bucket split).
    imageUrls: text("image_urls")
      .array()
      .notNull()
      .default(sql`'{}'`),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("manual_chunk_chunk_index_unique").on(t.chunkIndex)],
);

// One embedding per manual_chunk in v1. model is pinned per row so a future model
// upgrade can run side-by-side (ADR-006); dim is stored redundantly as a guard.
export const manualEmbedding = pgTable(
  "manual_embedding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => manualChunk.id, { onDelete: "cascade" }),
    model: text("model").notNull().default("gemini-embedding-001"),
    dim: integer("dim").notNull().default(1536),
    embedding: vector1536("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("manual_embedding_chunk_id_unique").on(t.chunkId),
    check("manual_embedding_dim_is_1536", sql`${t.dim} = 1536`),
  ],
);
