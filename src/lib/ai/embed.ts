import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";

/**
 * Gemini text-embedding helper for Mode 3 manual RAG (ADR-006/020).
 *
 * Verified against the installed types (per AGENTS.md, not training-data memory):
 *   - `embed` / `embedMany` from `ai@6` take `{ model, value(s), providerOptions }`
 *     and return `{ embedding }` / `{ embeddings }` (number[]).
 *   - the model is `google.textEmbeddingModel('gemini-embedding-001')`.
 *   - `outputDimensionality` is a provider option, passed as
 *     `providerOptions.google.outputDimensionality` (GoogleEmbeddingModelOptions
 *     in @ai-sdk/google@3, node_modules/@ai-sdk/google/dist/index.d.ts).
 *   - the provider reads GOOGLE_GENERATIVE_AI_API_KEY from the environment.
 *
 * Image links carried by manual sections are metadata, never embedded (ADR-006).
 */

export const EMBEDDING_MODEL_ID = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 1536;

const embeddingModel = google.textEmbeddingModel(EMBEDDING_MODEL_ID);

/**
 * gemini-embedding-001 supports asymmetric task types. Manual sections are
 * indexed as RETRIEVAL_DOCUMENT; a user question is embedded as RETRIEVAL_QUERY
 * so the query and corpus sit in the same retrieval space.
 */
type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

function providerOptionsFor(taskType: EmbeddingTaskType) {
  return {
    google: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
      taskType,
    },
  };
}

export async function embedQuery(question: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: question,
    providerOptions: providerOptionsFor("RETRIEVAL_QUERY"),
  });
  return embedding;
}

export async function embedManualSections(sectionBodies: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: sectionBodies,
    providerOptions: providerOptionsFor("RETRIEVAL_DOCUMENT"),
  });
  return embeddings;
}
