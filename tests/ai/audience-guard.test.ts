import { afterEach, describe, expect, test, vi } from "vitest";

const getCurrentUser = vi.fn();
const streamText = vi.fn(() => {
  throw new Error("streamText must not be called before the audience guard passes");
});

vi.mock("@/lib/rbac", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ai/persist", () => ({
  resolveSession: vi.fn(async () => "session-1"),
  recordUserTurn: vi.fn(async () => undefined),
  recordAssistantTurn: vi.fn(async () => undefined),
  recordGetNewsRetrieval: vi.fn(async () => undefined),
}));
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, streamText };
});

function request(body: unknown): Request {
  return new Request("http://test/api/rag/ask", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const turn = { mode: "get_news", messages: [] };

describe("audience guard — enforced before any LLM call", () => {
  afterEach(() => vi.clearAllMocks());

  test("anonymous caller -> 401, no LLM call", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/rag/ask/route");

    const response = await POST(request(turn));

    expect(response.status).toBe(401);
    expect(streamText).not.toHaveBeenCalled();
  });

  test("student-only caller -> 403, no LLM call", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", roles: ["student"] });
    const { POST } = await import("@/app/api/rag/ask/route");

    const response = await POST(request(turn));

    expect(response.status).toBe(403);
    expect(streamText).not.toHaveBeenCalled();
  });

  test("a non-Student role passes the guard (no 401/403)", async () => {
    getCurrentUser.mockResolvedValue({ id: "u2", roles: ["student", "parent"] });
    const { POST } = await import("@/app/api/rag/ask/route");

    const response = await POST(request(turn)).catch((error: Error) => error);

    const status = response instanceof Response ? response.status : null;
    expect(status).not.toBe(401);
    expect(status).not.toBe(403);
  });
});
