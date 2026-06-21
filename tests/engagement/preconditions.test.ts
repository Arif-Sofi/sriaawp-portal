import { beforeEach, describe, expect, test, vi } from "vitest";

// Preconditions enforced at the call site (NOT new permission codes):
// - a PENDING_VERIFICATION parent HOLDS news:comment/news:react but cannot exercise them;
// - a student may write only when the allow_student_comments toggle is on.
// Both reject the write before any DB insert.

const rbac = vi.hoisted(() => ({ requirePermission: vi.fn(), hasPermission: vi.fn() }));
const visibility = vi.hoisted(() => ({ getVisibleNewsById: vi.fn() }));
const settings = vi.hoisted(() => ({ studentCommentsAllowed: vi.fn() }));
const insertSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rbac", () => rbac);
vi.mock("@/lib/content/queries", () => visibility);
vi.mock("@/lib/engagement/queries", () => settings);
vi.mock("@/lib/pdpa/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/db", () => {
  const builder = {
    from: () => builder,
    where: () => builder,
    limit: () => Promise.resolve([]),
    values: () => builder,
    onConflictDoNothing: () => builder,
    returning: () => Promise.resolve([{ id: "new-row" }]),
  };
  const db = {
    select: () => builder,
    insert: (...args: unknown[]) => {
      insertSpy(...args);
      return builder;
    },
  };
  return { db };
});

const activeParent = {
  id: "parent-1",
  roles: ["parent"],
  status: "ACTIVE" as const,
  permissions: [],
  deptIds: [],
};

const pendingParent = { ...activeParent, status: "PENDING_VERIFICATION" as const };

const student = {
  id: "student-1",
  roles: ["student"],
  status: "ACTIVE" as const,
  permissions: [],
  deptIds: [],
};

const visibleNews = { id: "n-1", slug: "hello", authorUserId: "author-1", deptId: null };

describe("engagement write preconditions", () => {
  beforeEach(() => {
    rbac.requirePermission.mockReset();
    visibility.getVisibleNewsById.mockReset();
    settings.studentCommentsAllowed.mockReset();
    insertSpy.mockReset();
    visibility.getVisibleNewsById.mockResolvedValue(visibleNews);
  });

  test("a PENDING parent cannot post a comment", async () => {
    const { postComment } = await import("@/app/actions/engagement");
    rbac.requirePermission.mockResolvedValue(pendingParent);

    const result = await postComment("n-1", "hello");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_ACTIVE");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  test("a PENDING parent cannot react", async () => {
    const { toggleReaction } = await import("@/app/actions/engagement");
    rbac.requirePermission.mockResolvedValue(pendingParent);

    const result = await toggleReaction("n-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_ACTIVE");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  test("a student cannot comment when the toggle is OFF", async () => {
    const { postComment } = await import("@/app/actions/engagement");
    rbac.requirePermission.mockResolvedValue(student);
    settings.studentCommentsAllowed.mockResolvedValue(false);

    const result = await postComment("n-1", "hello");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("STUDENT_DISABLED");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  test("an ACTIVE parent posting an unseen news item is rejected before insert", async () => {
    const { postComment } = await import("@/app/actions/engagement");
    rbac.requirePermission.mockResolvedValue(activeParent);
    visibility.getVisibleNewsById.mockResolvedValue(null);

    const result = await postComment("n-hidden", "hello");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
