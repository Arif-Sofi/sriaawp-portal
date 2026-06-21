import type { ImageLink } from "@/lib/ai/envelope";

/**
 * Mode 3 flat exact retrieval over the manual corpus (ADR-020).
 *
 * At tens of chunks an HNSW index is over-sized (ADR-005 deferred to v2), so v1
 * ranks by a FLAT EXACT sequential cosine scan over the embedding table. The DB
 * path reads every manual_embedding row and ranks here; the pure cosine math is
 * factored into `cosineSimilarity` so the ranking + tau_refuse gate are
 * unit-tested without a DB or a live embedder.
 *
 * tau_refuse: if the top chunk's cosine similarity is below the threshold, the
 * query is off-manual and retrieval REFUSES (no grounded chunk). See
 * docs/phase-1/05-tech-spikes/spike-pgvector-gemini.md for the tuning
 * methodology and the documented starting point.
 */

/**
 * Methodology-derived starting point, NOT a live-measured value. Master-plan
 * 11.5 starts tau_refuse at 0.30 cosine for OSS-baseline embeddings; ADR-006
 * warns Gemini's cosine distribution differs, so this is a provisional start
 * pending live tuning on hand-written manual QA pairs (gated on a real Gemini
 * key). Derivation is documented in the spike write-up.
 */
export const DEFAULT_TAU_REFUSE = 0.3;

export type ManualChunkEmbedding = {
  chunkId: string;
  sectionHeading: string;
  content: string;
  imageLinks: ImageLink[];
  embedding: number[];
};

export type RankedManualChunk = {
  chunkId: string;
  sectionHeading: string;
  content: string;
  imageLinks: ImageLink[];
  score: number;
};

export type RetrievalResult =
  | { grounded: true; chunks: RankedManualChunk[] }
  | { grounded: false; reason: "below_tau_refuse"; topScore: number | null };

/**
 * Cosine similarity of two equal-length vectors. Returns 0 when either vector
 * has zero magnitude (an all-zero embedding has no direction to compare).
 * Pure and DB-free so the ranker is testable against known vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: length mismatch (${a.length} vs ${b.length})`);
  }

  const dot = a.reduce((sum, value, i) => sum + value * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dot / (magnitudeA * magnitudeB);
}

type RankOptions = {
  topK?: number;
  tauRefuse?: number;
};

/**
 * Flat exact scan: score every chunk against the query embedding, sort
 * descending, gate on tau_refuse, and return the top-k grounded chunks. This is
 * the pure core of `retrieve` — the DB path supplies `chunks` after reading the
 * embedding table; tests supply them directly.
 */
export function rankByCosine(
  queryEmbedding: number[],
  chunks: ManualChunkEmbedding[],
  options: RankOptions = {},
): RetrievalResult {
  const topK = options.topK ?? 4;
  const tauRefuse = options.tauRefuse ?? DEFAULT_TAU_REFUSE;

  if (chunks.length === 0) {
    return { grounded: false, reason: "below_tau_refuse", topScore: null };
  }

  const scored = chunks
    .map((chunk) => ({
      chunkId: chunk.chunkId,
      sectionHeading: chunk.sectionHeading,
      content: chunk.content,
      imageLinks: chunk.imageLinks,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((first, second) => second.score - first.score);

  const topScore = scored[0].score;
  if (topScore < tauRefuse) {
    return { grounded: false, reason: "below_tau_refuse", topScore };
  }

  return { grounded: true, chunks: scored.slice(0, topK) };
}
