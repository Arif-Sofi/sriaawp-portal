import type { UIMessage } from "ai";

export type AiMode = "in_article" | "get_news" | "manual_rag";

export type ImageLink = {
  url: string;
  caption: string | null;
  sectionId: string;
};

export type ChunkCitation = {
  chunkId: string;
  manualSection: string;
  score: number;
};

/**
 * The structured side-data the streaming envelope carries alongside text tokens.
 * Modes 1/2 leave both empty; only Mode 3 (manual RAG) populates them. They ride
 * as typed UI-message data parts (`data-image-links` / `data-citations`), which
 * the AI SDK v6 UI message stream interleaves with `text-delta` chunks over one
 * SSE response.
 */
export type AiSideData = {
  "image-links": ImageLink[];
  citations: ChunkCitation[];
};

export type AiUiMessage = UIMessage<never, AiSideData>;
