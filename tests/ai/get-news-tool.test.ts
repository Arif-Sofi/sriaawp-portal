import { describe, expect, test, vi } from "vitest";

import { createGetNewsTool, type GetNewsRow } from "@/lib/ai/tools/get-news";

type FakeRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  deptId: string | null;
  visibility: "public" | "internal" | "role_list";
  publishedAt: Date | null;
};

function row(overrides: Partial<FakeRow> & Pick<FakeRow, "id" | "title">): FakeRow {
  return {
    slug: overrides.title.toLowerCase().replace(/\s+/g, "-"),
    excerpt: null,
    body: "",
    deptId: null,
    visibility: "public",
    publishedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

const publicRow = row({ id: "n-public", title: "Public sports day" });
const internalRow = row({
  id: "n-internal",
  title: "Internal staff briefing",
  visibility: "internal",
});
const roleListRow = row({ id: "n-rolelist", title: "Teacher-only memo", visibility: "role_list" });

const parentVisible = [publicRow, internalRow];

function runTool(filters: Record<string, unknown>) {
  const fetchVisibleNews = vi.fn(async () => parentVisible as never);
  const tool = createGetNewsTool({ roles: ["parent"] }, fetchVisibleNews as never);
  return tool.execute!(filters as never, { toolCallId: "t1", messages: [] }) as Promise<
    GetNewsRow[]
  >;
}

describe("createGetNewsTool — caller-scope bound", () => {
  test("delegates the visibility scope to listVisibleNews with the caller", async () => {
    const fetchVisibleNews = vi.fn(async () => parentVisible as never);
    const tool = createGetNewsTool({ roles: ["parent"] }, fetchVisibleNews as never);

    await tool.execute!({} as never, { toolCallId: "t1", messages: [] });

    expect(fetchVisibleNews).toHaveBeenCalledWith({ roles: ["parent"] });
  });

  test("never returns a row outside the listVisibleNews result set", async () => {
    const result = await runTool({});

    const returnedIds = result.map((r) => r.id);
    const visibleIds = parentVisible.map((r) => r.id);
    expect(returnedIds.every((id) => visibleIds.includes(id))).toBe(true);
    expect(returnedIds).not.toContain(roleListRow.id);
  });

  test("keyword filter narrows within the bounded set, never widens it", async () => {
    const result = await runTool({ keyword: "sports" });

    expect(result.map((r) => r.id)).toEqual([publicRow.id]);
  });

  test("recency filter excludes news published before the cutoff", async () => {
    const result = await runTool({ sinceISO: "2026-06-15T00:00:00.000Z" });

    expect(result).toHaveLength(0);
  });
});
