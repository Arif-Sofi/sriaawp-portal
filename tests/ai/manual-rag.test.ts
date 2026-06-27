import { afterEach, describe, expect, test, vi } from "vitest";

import type { ManualChunkEmbedding } from "@/lib/ai/retrieve";

type VectorEntry = {
  userId: string;
  queryText: string;
  chunkIds: string[];
  scores: number[];
  latencyMs: number;
  refusedReason: string | null;
};

type ManualTurnEntry = {
  sessionId: string;
  content: string;
  citations: unknown[];
  latencyMs: number;
  refusedReason: string | null;
};

const getCurrentUser = vi.fn();
const embedQuery = vi.fn<(question: string) => Promise<number[]>>();
const loadManualCorpus = vi.fn<() => Promise<ManualChunkEmbedding[]>>();
const recordVectorRetrieval = vi.fn<(entry: VectorEntry) => Promise<void>>();
const recordManualRagTurn = vi.fn<(turn: ManualTurnEntry) => Promise<void>>();
const streamText = vi.fn();

vi.mock("@/lib/rbac", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ai/embed", () => ({ embedQuery }));
vi.mock("@/lib/ai/manual-retrieve", () => ({ loadManualCorpus }));
vi.mock("@/lib/storage/manual-images", () => ({
  resolveManualImages: vi.fn(async (links: unknown[]) => links),
}));
vi.mock("@/lib/ai/persist", () => ({
  resolveSession: vi.fn(async () => "session-1"),
  recordUserTurn: vi.fn(async () => undefined),
  recordVectorRetrieval,
  recordManualRagTurn,
}));
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: (...args: unknown[]) => {
      streamText(...args);
      return { toUIMessageStream: () => new ReadableStream() };
    },
  };
});

function chunk(chunkId: string, embedding: number[]): ManualChunkEmbedding {
  return {
    chunkId,
    sectionHeading: `Section ${chunkId}`,
    content: `body of ${chunkId}`,
    imageLinks: [{ url: `https://img/${chunkId}.png`, caption: null, sectionId: chunkId }],
    embedding,
  };
}

const corpus = [chunk("reset-password", [1, 0, 0]), chunk("read-news", [0, 1, 0])];

function request(body: unknown): Request {
  return new Request("http://test/api/rag/ask", { method: "POST", body: JSON.stringify(body) });
}

function manualTurn(text: string): unknown {
  return {
    mode: "manual_rag",
    messages: [{ role: "user", parts: [{ type: "text", text }] }],
  };
}

describe("Mode 3 manual RAG — flat scan + tau_refuse", () => {
  afterEach(() => vi.clearAllMocks());

  test("an on-manual query grounds: top chunk persisted, LLM invoked", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", roles: ["parent"] });
    embedQuery.mockResolvedValue([0.9, 0.1, 0]);
    loadManualCorpus.mockResolvedValue(corpus);
    const { POST } = await import("@/app/api/rag/ask/route");

    const response = await POST(request(manualTurn("how do I reset my password")));

    expect(response.status).toBe(200);
    expect(streamText).toHaveBeenCalledTimes(1);
    const [vectorEntry] = recordVectorRetrieval.mock.calls[0];
    expect(vectorEntry.chunkIds[0]).toBe("reset-password");
    expect(vectorEntry.refusedReason).toBeNull();
  });

  test("an off-manual query trips tau_refuse: no LLM call, refusal persisted", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", roles: ["parent"] });
    embedQuery.mockResolvedValue([0, 0, 1]);
    loadManualCorpus.mockResolvedValue(corpus);
    const { POST } = await import("@/app/api/rag/ask/route");

    const response = await POST(request(manualTurn("what is the weather today")));

    expect(response.status).toBe(200);
    expect(streamText).not.toHaveBeenCalled();
    const [turn] = recordManualRagTurn.mock.calls[0];
    expect(turn.refusedReason).toBe("below_tau_refuse");
    expect(turn.citations).toEqual([]);
    const [vectorEntry] = recordVectorRetrieval.mock.calls[0];
    expect(vectorEntry.refusedReason).toBe("below_tau_refuse");
    expect(vectorEntry.chunkIds).toEqual([]);
  });

  test("a student-only caller is blocked from manual_rag before any embed", async () => {
    getCurrentUser.mockResolvedValue({ id: "s1", roles: ["student"] });
    const { POST } = await import("@/app/api/rag/ask/route");

    const response = await POST(request(manualTurn("how do I reset my password")));

    expect(response.status).toBe(403);
    expect(embedQuery).not.toHaveBeenCalled();
    expect(streamText).not.toHaveBeenCalled();
  });

  test("an anonymous caller is blocked from manual_rag before any embed", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/rag/ask/route");

    const response = await POST(request(manualTurn("how do I reset my password")));

    expect(response.status).toBe(401);
    expect(embedQuery).not.toHaveBeenCalled();
  });
});
