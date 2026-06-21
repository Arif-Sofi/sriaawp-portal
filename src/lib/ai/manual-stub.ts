import type { ChunkCitation, ImageLink } from "@/lib/ai/envelope";

/**
 * Stand-in for the Mode 3 retrieval result. Real retrieval (embed -> flat cosine
 * scan over the manual corpus) is spike #13 / issue #81; the manual itself does
 * not exist yet (ADR-020 open dependency). This stub lets the streaming envelope
 * be proven end-to-end without any embedding work.
 */
export type RetrievedManualChunk = {
  chunkId: string;
  manualSection: string;
  text: string;
  imageLinks: ImageLink[];
};

export const STUBBED_MANUAL_CHUNK: RetrievedManualChunk = {
  chunkId: "manual-chunk-0001",
  manualSection: "Resetting your password",
  text: "Open the account menu, choose Reset password, and follow the emailed link.",
  imageLinks: [
    {
      url: "https://storage.example/manual/reset-password-step-1.png",
      caption: "Account menu with the Reset password item highlighted",
      sectionId: "reset-password",
    },
  ],
};

export function citationFor(chunk: RetrievedManualChunk): ChunkCitation {
  return { chunkId: chunk.chunkId, manualSection: chunk.manualSection, score: 1 };
}
