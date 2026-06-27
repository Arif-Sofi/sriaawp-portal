import { sql } from "drizzle-orm";

import { manualChunk, manualEmbedding } from "@/db/schema";
import { embedManualSections, EMBEDDING_MODEL_ID } from "@/lib/ai/embed";
import { STAND_IN_MANUAL, type ManualSection } from "@/lib/ai/manual/stand-in";
import type { db as Database } from "@/lib/db";

/**
 * Mode-3 manual ingest (ADR-020, issue #81): read the manual sections from a
 * SINGLE content source, embed each section once, and (re)load manual_chunk +
 * manual_embedding. Swapping the PM's real manual in is a CONTENT re-ingest, not
 * a code change: replace the source module's sections and re-run this. The
 * source defaults to the synthetic stand-in (STAND_IN_MANUAL) while the real
 * manual is pending the PM (P0-Q18).
 *
 * Re-runnable: a truncate-and-reload inside one transaction so re-ingesting the
 * same or a new manual leaves no stale chunks. chunk_index is the section's
 * position in the source, keeping the corpus deterministic across re-ingests.
 *
 * Embedding goes through embedManualSections (gemini-embedding-001 @ 1536-d,
 * RETRIEVAL_DOCUMENT). The live call needs GOOGLE_GENERATIVE_AI_API_KEY; with an
 * empty key it fails at the credential boundary, so this is a TURN-ON step (run
 * after migration 0008 is applied and a real Gemini key is present).
 */

type Db = typeof Database;

type IngestSummary = {
  sectionCount: number;
  model: string;
};

const PGVECTOR_LITERAL_OPEN = "[";
const PGVECTOR_LITERAL_CLOSE = "]";

function toPgvectorLiteral(embedding: number[]): string {
  return `${PGVECTOR_LITERAL_OPEN}${embedding.join(",")}${PGVECTOR_LITERAL_CLOSE}`;
}

export async function ingestManual(
  database: Db,
  sections: ManualSection[] = STAND_IN_MANUAL,
): Promise<IngestSummary> {
  if (sections.length === 0) throw new Error("ingestManual: no manual sections to ingest");

  const embeddings = await embedManualSections(sections.map((section) => section.body));
  if (embeddings.length !== sections.length) {
    throw new Error(
      `ingestManual: embedded ${embeddings.length} vectors for ${sections.length} sections`,
    );
  }

  await database.transaction(async (tx) => {
    await tx.execute(sql`truncate table ${manualEmbedding}, ${manualChunk} cascade`);

    for (const [sectionIndex, section] of sections.entries()) {
      const [chunkRow] = await tx
        .insert(manualChunk)
        .values({
          sectionHeading: section.heading,
          chunkIndex: sectionIndex,
          content: section.body,
          imageUrls: section.imageLinks.map((link) => link.url),
        })
        .returning({ id: manualChunk.id });

      await tx.insert(manualEmbedding).values({
        chunkId: chunkRow.id,
        model: EMBEDDING_MODEL_ID,
        dim: 1536,
        embedding: sql`${toPgvectorLiteral(embeddings[sectionIndex])}::vector(1536)`,
      });
    }
  });

  return { sectionCount: sections.length, model: EMBEDDING_MODEL_ID };
}
