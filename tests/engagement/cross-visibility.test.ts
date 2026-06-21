import { beforeEach, describe, expect, test, vi } from "vitest";

// R-04 engagement analogue: read access to comments and reaction counts MUST inherit the parent
// news item's visibility. listCommentsForNews / getReactionState delegate that bound to
// getVisibleNewsById, so a caller who cannot see the news must get empty/null with no leak.

const visibility = vi.hoisted(() => ({ getVisibleNewsById: vi.fn() }));
const commentRows = vi.hoisted(() => ({ value: [] as unknown[] }));
const reactionCount = vi.hoisted(() => ({ value: 0 }));

vi.mock("@/lib/content/queries", () => visibility);

vi.mock("@/lib/db", () => {
  const commentBuilder = {
    from: () => commentBuilder,
    leftJoin: () => commentBuilder,
    where: () => commentBuilder,
    orderBy: () => Promise.resolve(commentRows.value),
    limit: () => Promise.resolve([]),
  };
  const countBuilder = {
    from: () => countBuilder,
    where: () => Promise.resolve([{ value: reactionCount.value }]),
  };
  const db = {
    select: (shape?: Record<string, unknown>) => {
      if (shape && "value" in shape) return countBuilder;
      return commentBuilder;
    },
  };
  return { db };
});

const teacherOnlyNews = {
  id: "n-teacher",
  slug: "teacher-memo",
  visibility: "role_list" as const,
  visibilityRoles: ["teacher"],
  authorUserId: "author-1",
  deptId: null,
  publishedAt: new Date("2026-06-01T00:00:00.000Z"),
};

describe("R-04 engagement cross-visibility — read path inherits news visibility", () => {
  beforeEach(() => {
    visibility.getVisibleNewsById.mockReset();
    commentRows.value = [];
    reactionCount.value = 0;
  });

  test("listCommentsForNews returns empty when caller cannot see the news", async () => {
    const { listCommentsForNews } = await import("@/lib/engagement/queries");
    visibility.getVisibleNewsById.mockResolvedValue(null);
    commentRows.value = [
      {
        id: "c-1",
        parentCommentId: null,
        body: "secret",
        status: "visible",
        authorUserId: "u-1",
        authorName: "Cikgu",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await listCommentsForNews(teacherOnlyNews.id, { roles: ["parent"] } as never);

    expect(result).toEqual([]);
  });

  test("listCommentsForNews returns the thread when caller can see the news", async () => {
    const { listCommentsForNews } = await import("@/lib/engagement/queries");
    visibility.getVisibleNewsById.mockResolvedValue(teacherOnlyNews);
    commentRows.value = [
      {
        id: "c-1",
        parentCommentId: null,
        body: "question",
        status: "visible",
        authorUserId: "u-1",
        authorName: "Cikgu",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await listCommentsForNews(teacherOnlyNews.id, { roles: ["teacher"] } as never);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c-1");
  });

  test("getReactionState returns null when caller cannot see the news", async () => {
    const { getReactionState } = await import("@/lib/engagement/queries");
    visibility.getVisibleNewsById.mockResolvedValue(null);
    reactionCount.value = 5;

    const result = await getReactionState(teacherOnlyNews.id, { roles: ["parent"] } as never);

    expect(result).toBeNull();
  });

  test("getReactionState exposes the count when caller can see the news", async () => {
    const { getReactionState } = await import("@/lib/engagement/queries");
    visibility.getVisibleNewsById.mockResolvedValue(teacherOnlyNews);
    reactionCount.value = 5;

    const result = await getReactionState(teacherOnlyNews.id, {
      roles: ["teacher"],
      id: "x",
    } as never);

    expect(result?.count).toBe(5);
  });
});
