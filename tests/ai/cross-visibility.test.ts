import { beforeEach, describe, expect, test, vi } from "vitest";

import { createGetNewsTool, type GetNewsRow } from "@/lib/ai/tools/get-news";

type NewsRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  deptId: string | null;
  visibility: "public" | "internal" | "role_list";
  visibilityRoles: string[] | null;
  publishedAt: Date | null;
};

function makeRow(overrides: Partial<NewsRow> & Pick<NewsRow, "id" | "title">): NewsRow {
  return {
    slug: overrides.title.toLowerCase().replace(/\s+/g, "-"),
    excerpt: null,
    body: "",
    deptId: null,
    visibility: "public",
    visibilityRoles: null,
    publishedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

const publicRow = makeRow({ id: "n-public", title: "Public sports day" });
const internalRow = makeRow({
  id: "n-internal",
  title: "Internal briefing",
  visibility: "internal",
});
const teacherOnlyRow = makeRow({
  id: "n-teacher",
  title: "Teacher-only memo",
  visibility: "role_list",
  visibilityRoles: ["teacher"],
});

const ALL_NEWS = [publicRow, internalRow, teacherOnlyRow];

// Faithful re-implementation of the ADR-010 predicate listVisibleNews enforces,
// so the attack test exercises the real visibility bound the tool delegates to.
function visibleTo(roles: string[]): NewsRow[] {
  return ALL_NEWS.filter((row) => {
    if (!row.publishedAt) return false;
    if (row.visibility === "public") return true;
    if (row.visibility === "internal") return true;
    return (row.visibilityRoles ?? []).some((code) => roles.includes(code));
  });
}

describe("R-04 Mode 2 cross-visibility attack — get_news", () => {
  test("a parent cannot surface a teacher-only news item through the tool", async () => {
    const fetchVisibleNews = vi.fn(async (caller: { roles: string[] }) => visibleTo(caller.roles));
    const tool = createGetNewsTool({ roles: ["parent"] }, fetchVisibleNews as never);

    const result = (await tool.execute!({ keyword: "memo" } as never, {
      toolCallId: "t1",
      messages: [],
    })) as GetNewsRow[];

    expect(result.map((r) => r.id)).not.toContain(teacherOnlyRow.id);
  });

  test("a teacher CAN see the role_list item the parent cannot", async () => {
    const fetchVisibleNews = vi.fn(async (caller: { roles: string[] }) => visibleTo(caller.roles));
    const tool = createGetNewsTool({ roles: ["teacher"] }, fetchVisibleNews as never);

    const result = (await tool.execute!({ keyword: "memo" } as never, {
      toolCallId: "t2",
      messages: [],
    })) as GetNewsRow[];

    expect(result.map((r) => r.id)).toContain(teacherOnlyRow.id);
  });
});

const dbRows = vi.hoisted(() => ({ value: [] as unknown[] }));

vi.mock("@/lib/db", () => {
  const builder = {
    select: () => builder,
    from: () => builder,
    where: () => builder,
    limit: () => Promise.resolve(dbRows.value),
  };
  return { db: builder };
});

describe("R-04 Mode 1 cross-visibility attack — getVisibleNewsById", () => {
  beforeEach(() => {
    dbRows.value = [];
  });

  test("refuses a role_list id the caller's roles do not match (returns null)", async () => {
    const { getVisibleNewsById } = await import("@/lib/content/queries");
    dbRows.value = [teacherOnlyRow];

    const refused = await getVisibleNewsById(teacherOnlyRow.id, { roles: ["parent"] } as never);

    expect(refused).toBeNull();
  });

  test("grounds a role_list id when the caller's role matches", async () => {
    const { getVisibleNewsById } = await import("@/lib/content/queries");
    dbRows.value = [teacherOnlyRow];

    const granted = await getVisibleNewsById(teacherOnlyRow.id, { roles: ["teacher"] } as never);

    expect(granted?.id).toBe(teacherOnlyRow.id);
  });

  test("refuses an internal id for an anonymous caller (returns null)", async () => {
    const { getVisibleNewsById } = await import("@/lib/content/queries");
    dbRows.value = [internalRow];

    const refused = await getVisibleNewsById(internalRow.id, null);

    expect(refused).toBeNull();
  });

  test("refuses an unpublished public id (returns null)", async () => {
    const { getVisibleNewsById } = await import("@/lib/content/queries");
    dbRows.value = [makeRow({ id: "n-draft", title: "Draft", publishedAt: null })];

    const refused = await getVisibleNewsById("n-draft", { roles: ["teacher"] } as never);

    expect(refused).toBeNull();
  });
});
