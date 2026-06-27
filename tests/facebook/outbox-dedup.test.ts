import { beforeEach, describe, expect, test, vi } from "vitest";

import { fbSyncLink, idempotency, news, outbox } from "@/db/schema";
import { MockFacebookClient } from "@/lib/facebook";

// Dedup + loop-prevention (ADR-022): the worker is idempotent on content_hash. Re-enqueuing an
// UNCHANGED post and draining twice publishes to the Page exactly ONCE (the idempotency row short-
// circuits the second drain). An EDITED post (changed hash) re-publishes. The worker also re-checks
// the public-only guard: a row that flipped to non-public after enqueue is dropped, never pushed.

type Row = Record<string, unknown>;

const settings = vi.hoisted(() => ({
  facebookSyncEnabled: vi.fn(),
  FACEBOOK_SYNC_ENABLED_KEY: "facebook_sync_enabled",
  FACEBOOK_PUBLISH_TOPIC: "facebook.publish",
}));

vi.mock("@/lib/facebook/settings", () => settings);
vi.mock("@/lib/pdpa/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ requirePermission: vi.fn(), hasPermission: vi.fn() }));

// In-memory store routed by table reference. Each table is an array of rows; the builders below
// implement only the chains the worker uses.
const store = vi.hoisted(() => ({
  tables: new Map<unknown, Record<string, unknown>[]>(),
}));

vi.mock("@/lib/db", () => {
  const rowsFor = (table: unknown): Row[] => {
    const existing = store.tables.get(table);
    if (existing) return existing as Row[];
    const created: Row[] = [];
    store.tables.set(table, created);
    return created;
  };

  // Pull the bound literal out of a drizzle eq(col, value) condition so the mock can filter by
  // key/id. Drizzle wraps the bound value in a Param chunk whose .value holds the literal.
  const whereValue = (condition: unknown): unknown => {
    const chunks = (
      condition as { queryChunks?: { constructor?: { name?: string } }[] } | undefined
    )?.queryChunks;
    if (!chunks) return undefined;
    const param = chunks.find((chunk) => chunk?.constructor?.name === "Param");
    return (param as { value?: unknown } | undefined)?.value;
  };

  // Filter only the point-lookup tables (news by id, idempotency by key). The outbox drain selects
  // by topic + dispatchedAt and must return every seeded job, so it is not filtered here.
  const matches = (table: unknown, rows: Row[], condition: unknown): Row[] => {
    const value = whereValue(condition);
    if (value === undefined) return rows;
    if (table === idempotency) return rows.filter((row) => row.key === value);
    if (table === news || table === fbSyncLink) return rows.filter((row) => row.id === value);
    return rows;
  };

  const selectBuilder = (table: unknown, rows: Row[]) => {
    let filtered = rows;
    const builder = {
      from: () => builder,
      where: (condition: unknown) => {
        filtered = matches(table, rows, condition);
        return builder;
      },
      limit: () => Promise.resolve(filtered),
      then: (resolve: (value: Row[]) => unknown) => resolve(filtered),
    };
    return builder;
  };

  const db = {
    select: () => ({
      from: (table: unknown) => selectBuilder(table, rowsFor(table)),
    }),
    insert: (table: unknown) => ({
      values: (value: Row | Row[]) => {
        const next = Array.isArray(value) ? value : [value];
        const withIds = next.map((row, index) => ({
          id: `gen-${rowsFor(table).length + index}`,
          ...row,
        }));
        rowsFor(table).push(...withIds);
        const result = {
          onConflictDoNothing: () => Promise.resolve(undefined),
          returning: () => Promise.resolve(withIds),
          then: (resolve: (value: undefined) => unknown) => resolve(undefined),
        };
        return result;
      },
    }),
    update: (table: unknown) => ({
      set: (patch: Row) => ({
        where: () => {
          // The worker updates by a single id-or-key; apply the patch to every seeded row of the
          // table (each test seeds exactly the row(s) it asserts on).
          for (const row of rowsFor(table)) Object.assign(row, patch);
          return Promise.resolve(undefined);
        },
      }),
    }),
  };
  return { db };
});

const publishedAt = new Date("2026-06-01T00:00:00.000Z");

const seedNews = (overrides: Partial<Row> = {}): Row => ({
  id: "n-public",
  title: "Sports Day",
  slug: "sports-day",
  excerpt: "Join us",
  body: "Full body",
  visibility: "public",
  publishedAt,
  ...overrides,
});

const reset = () => {
  store.tables.clear();
  store.tables.set(news, []);
  store.tables.set(outbox, []);
  store.tables.set(idempotency, []);
  store.tables.set(fbSyncLink, []);
};

const seedOutboxJob = (newsId: string, linkId: string) => {
  (store.tables.get(outbox) as Row[]).push({
    id: `ob-${newsId}`,
    topic: "facebook.publish",
    payload: { newsId, fbSyncLinkId: linkId },
    dispatchedAt: null,
  });
  (store.tables.get(fbSyncLink) as Row[]).push({
    id: linkId,
    portalNewsId: newsId,
    direction: "outbound",
    syncStatus: "pending",
    contentHash: "stale",
  });
};

describe("dispatchFacebookOutbox dedup + loop-prevention", () => {
  beforeEach(() => {
    settings.facebookSyncEnabled.mockReset();
    settings.facebookSyncEnabled.mockResolvedValue(true);
    reset();
  });

  test("publishes a public post once and records fb_object_id", async () => {
    const { dispatchFacebookOutbox } = await import("@/lib/facebook/outbox-worker");
    (store.tables.get(news) as Row[]).push(seedNews());
    seedOutboxJob("n-public", "link-1");
    const client = new MockFacebookClient();

    const result = await dispatchFacebookOutbox(client);

    expect(result.published).toBe(1);
    expect(client.recordedCalls()).toHaveLength(1);
    const [link] = store.tables.get(fbSyncLink) as Row[];
    expect(link.syncStatus).toBe("synced");
    expect(typeof link.fbObjectId).toBe("string");
  });

  test("an unchanged post drained twice publishes to the mock exactly once", async () => {
    const { dispatchFacebookOutbox } = await import("@/lib/facebook/outbox-worker");
    (store.tables.get(news) as Row[]).push(seedNews());
    seedOutboxJob("n-public", "link-1");
    const client = new MockFacebookClient();

    await dispatchFacebookOutbox(client);
    // Second enqueue of the SAME content + second drain: idempotency on content_hash short-circuits.
    (store.tables.get(outbox) as Row[]).forEach((row) => {
      row.dispatchedAt = null;
    });
    await dispatchFacebookOutbox(client);

    expect(client.recordedCalls()).toHaveLength(1);
  });

  test("an edited post (changed content) re-publishes", async () => {
    const { dispatchFacebookOutbox } = await import("@/lib/facebook/outbox-worker");
    (store.tables.get(news) as Row[]).push(seedNews());
    seedOutboxJob("n-public", "link-1");
    const client = new MockFacebookClient();

    await dispatchFacebookOutbox(client);

    // Edit the outbound subset (the excerpt, which drives the message) and re-drain. This changes
    // the content_hash, so the idempotency short-circuit does not apply and the post re-publishes.
    (store.tables.get(news) as Row[]).forEach((row) => {
      row.excerpt = "Updated summary for parents";
    });
    (store.tables.get(outbox) as Row[]).forEach((row) => {
      row.dispatchedAt = null;
    });
    await dispatchFacebookOutbox(client);

    expect(client.recordedCalls()).toHaveLength(2);
  });

  test("worker re-check drops a row that is no longer public (no push)", async () => {
    const { dispatchFacebookOutbox } = await import("@/lib/facebook/outbox-worker");
    (store.tables.get(news) as Row[]).push(seedNews({ visibility: "internal" }));
    seedOutboxJob("n-public", "link-1");
    const client = new MockFacebookClient();

    const result = await dispatchFacebookOutbox(client);

    expect(result.skipped).toBe(1);
    expect(client.recordedCalls()).toHaveLength(0);
    const [link] = store.tables.get(fbSyncLink) as Row[];
    expect(link.syncStatus).toBe("failed");
  });

  test("kill-switch off makes the worker a no-op", async () => {
    const { dispatchFacebookOutbox } = await import("@/lib/facebook/outbox-worker");
    settings.facebookSyncEnabled.mockResolvedValue(false);
    (store.tables.get(news) as Row[]).push(seedNews());
    seedOutboxJob("n-public", "link-1");
    const client = new MockFacebookClient();

    const result = await dispatchFacebookOutbox(client);

    expect(result.drained).toBe(0);
    expect(client.recordedCalls()).toHaveLength(0);
  });
});
