import { beforeEach, describe, expect, test, vi } from "vitest";

import { news } from "@/db/schema";

// R-04 public-only leak guard (ADR-022): the outbound boundary is a POSITIVE allow-list keyed on
// visibility='public' AND published. internal / role_list / unpublished are HARD-REJECTED at
// enqueueFacebookSync before any fb_sync_link or outbox row is written. The worker re-checks the
// same predicate (defense in depth): a row that has since changed to non-public is dropped, never
// pushed to the mock.

const rbac = vi.hoisted(() => ({ requirePermission: vi.fn(), hasPermission: vi.fn() }));
const settings = vi.hoisted(() => ({
  facebookSyncEnabled: vi.fn(),
  FACEBOOK_SYNC_ENABLED_KEY: "facebook_sync_enabled",
  FACEBOOK_PUBLISH_TOPIC: "facebook.publish",
}));
const newsRow = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));
const insertSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rbac", () => rbac);
vi.mock("@/lib/facebook/settings", () => settings);
vi.mock("@/lib/pdpa/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/db", () => {
  // The news lookup returns the row under test; the fb_sync_link lookup returns no existing link so
  // enqueue takes the insert path (asserting BOTH the link and outbox rows are written).
  const selectFor = (table: unknown) => {
    const rows = table === news && newsRow.value ? [newsRow.value] : [];
    const builder = {
      from: () => builder,
      where: () => builder,
      limit: () => Promise.resolve(rows),
    };
    return builder;
  };
  const writeBuilder = {
    values: () => writeBuilder,
    set: () => writeBuilder,
    where: () => Promise.resolve(undefined),
    onConflictDoNothing: () => Promise.resolve(undefined),
    onConflictDoUpdate: () => Promise.resolve(undefined),
    returning: () => Promise.resolve([{ id: "link-1" }]),
  };
  const db = {
    select: () => ({ from: (table: unknown) => selectFor(table) }),
    insert: (...args: unknown[]) => {
      insertSpy(...args);
      return writeBuilder;
    },
    update: () => writeBuilder,
  };
  return { db };
});

const admin = { id: "admin-1", roles: ["admin"], permissions: [], deptIds: [] };

const publishedAt = new Date("2026-06-01T00:00:00.000Z");

const publicNews = {
  id: "n-public",
  title: "Sports Day",
  slug: "sports-day",
  excerpt: "Join us",
  body: "Full body",
  visibility: "public" as const,
  publishedAt,
};

describe("enqueueFacebookSync public-only allow-list (R-04)", () => {
  beforeEach(() => {
    rbac.requirePermission.mockReset();
    rbac.requirePermission.mockResolvedValue(admin);
    settings.facebookSyncEnabled.mockReset();
    settings.facebookSyncEnabled.mockResolvedValue(true);
    insertSpy.mockReset();
    newsRow.value = null;
  });

  test("rejects an internal news item with nothing enqueued", async () => {
    const { enqueueFacebookSync } = await import("@/app/actions/facebook");
    newsRow.value = { ...publicNews, id: "n-internal", visibility: "internal" };

    const result = await enqueueFacebookSync("n-internal");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_PUBLIC");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  test("rejects a role_list news item with nothing enqueued", async () => {
    const { enqueueFacebookSync } = await import("@/app/actions/facebook");
    newsRow.value = { ...publicNews, id: "n-role", visibility: "role_list" };

    const result = await enqueueFacebookSync("n-role");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_PUBLIC");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  test("rejects an unpublished public draft with nothing enqueued", async () => {
    const { enqueueFacebookSync } = await import("@/app/actions/facebook");
    newsRow.value = { ...publicNews, id: "n-draft", publishedAt: null };

    const result = await enqueueFacebookSync("n-draft");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_PUBLIC");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  test("no-ops when the global kill-switch is off", async () => {
    const { enqueueFacebookSync } = await import("@/app/actions/facebook");
    settings.facebookSyncEnabled.mockResolvedValue(false);
    newsRow.value = publicNews;

    const result = await enqueueFacebookSync("n-public");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SYNC_DISABLED");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  test("enqueues a public published post (outbox + fb_sync_link written)", async () => {
    const { enqueueFacebookSync } = await import("@/app/actions/facebook");
    newsRow.value = publicNews;

    const result = await enqueueFacebookSync("n-public");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("pending");
    // One insert for the fb_sync_link row, one for the outbox row.
    expect(insertSpy).toHaveBeenCalledTimes(2);
  });
});
