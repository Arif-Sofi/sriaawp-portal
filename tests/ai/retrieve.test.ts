import { describe, expect, test } from "vitest";

import { cosineSimilarity, rankByCosine, type ManualChunkEmbedding } from "@/lib/ai/retrieve";

function chunk(chunkId: string, embedding: number[], heading = chunkId): ManualChunkEmbedding {
  return {
    chunkId,
    sectionHeading: heading,
    content: `body of ${chunkId}`,
    imageLinks: [{ url: `https://img/${chunkId}.png`, caption: null, sectionId: chunkId }],
    embedding,
  };
}

describe("cosineSimilarity", () => {
  test("identical direction has similarity 1", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  test("orthogonal vectors have similarity 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  test("opposite direction has similarity -1", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  test("magnitude does not change cosine", () => {
    expect(cosineSimilarity([1, 1], [5, 5])).toBeCloseTo(1, 10);
  });

  test("a zero vector yields 0, not NaN", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  test("length mismatch throws", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/length mismatch/);
  });
});

describe("rankByCosine — flat exact scan", () => {
  const corpus = [
    chunk("reset-password", [1, 0, 0]),
    chunk("read-news", [0, 1, 0]),
    chunk("link-family", [0, 0, 1]),
  ];

  test("the closest chunk ranks first", () => {
    const result = rankByCosine([0.9, 0.1, 0], corpus, { tauRefuse: 0.3 });
    expect(result.grounded).toBe(true);
    if (!result.grounded) return;
    expect(result.chunks[0].chunkId).toBe("reset-password");
  });

  test("topK bounds the returned chunk count", () => {
    const result = rankByCosine([1, 1, 1], corpus, { tauRefuse: 0, topK: 2 });
    expect(result.grounded).toBe(true);
    if (!result.grounded) return;
    expect(result.chunks).toHaveLength(2);
  });

  test("grounded chunks carry image-link metadata for issue #81", () => {
    const result = rankByCosine([1, 0, 0], corpus, { tauRefuse: 0.3 });
    expect(result.grounded).toBe(true);
    if (!result.grounded) return;
    expect(result.chunks[0].imageLinks[0].sectionId).toBe("reset-password");
  });
});

describe("rankByCosine — tau_refuse gate", () => {
  const corpus = [chunk("reset-password", [1, 0, 0]), chunk("read-news", [0, 1, 0])];

  test("an orthogonal (off-manual) query trips the refusal", () => {
    const result = rankByCosine([0, 0, 1], corpus, { tauRefuse: 0.3 });
    expect(result.grounded).toBe(false);
    if (result.grounded) return;
    expect(result.reason).toBe("below_tau_refuse");
    expect(result.topScore).toBe(0);
  });

  test("an on-manual query above tau_refuse is grounded", () => {
    const result = rankByCosine([0.8, 0.2, 0], corpus, { tauRefuse: 0.3 });
    expect(result.grounded).toBe(true);
  });

  test("an empty corpus refuses with a null top score", () => {
    const result = rankByCosine([1, 0, 0], [], { tauRefuse: 0.3 });
    expect(result.grounded).toBe(false);
    if (result.grounded) return;
    expect(result.topScore).toBeNull();
  });
});
