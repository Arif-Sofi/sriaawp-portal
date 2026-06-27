import { eq } from "drizzle-orm";

import { manualChunk, manualEmbedding } from "@/db/schema";
import { db } from "@/lib/db";
import type { ImageLink } from "@/lib/ai/envelope";
import type { ManualChunkEmbedding } from "@/lib/ai/retrieve";

/**
 * DB read for Mode-3 retrieval (issue #81): loads every manual_chunk joined to
 * its manual_embedding and adapts the rows to retrieve.ts's ManualChunkEmbedding
 * shape so the pure flat-scan ranker stays DB-free and unit-testable (SLAP). At
 * tens of chunks the whole table is read; the cosine scan + tau_refuse gate run
 * in retrieve.ts. The image-link metadata is reconstructed from image_urls,
 * sectionId-keyed on the chunk's id so the envelope can attribute each image.
 */

const PGVECTOR_LITERAL = /^\[(.*)\]$/;

function parseEmbedding(driverValue: number[] | string): number[] {
  if (Array.isArray(driverValue)) return driverValue;
  const match = PGVECTOR_LITERAL.exec(driverValue);
  if (!match) throw new Error("manual-retrieve: unrecognized pgvector literal");
  if (match[1].length === 0) return [];
  return match[1].split(",").map(Number);
}

function imageLinksFor(chunkId: string, urls: string[]): ImageLink[] {
  return urls.map((url) => ({ url, caption: null, sectionId: chunkId }));
}

export async function loadManualCorpus(): Promise<ManualChunkEmbedding[]> {
  const rows = await db
    .select({
      chunkId: manualChunk.id,
      sectionHeading: manualChunk.sectionHeading,
      content: manualChunk.content,
      imageUrls: manualChunk.imageUrls,
      embedding: manualEmbedding.embedding,
    })
    .from(manualChunk)
    .innerJoin(manualEmbedding, eq(manualEmbedding.chunkId, manualChunk.id));

  return rows.map((row) => ({
    chunkId: row.chunkId,
    sectionHeading: row.sectionHeading,
    content: row.content,
    imageLinks: imageLinksFor(row.chunkId, row.imageUrls),
    embedding: parseEmbedding(row.embedding as number[] | string),
  }));
}
