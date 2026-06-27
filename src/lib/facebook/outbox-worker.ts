import { and, eq, isNull } from "drizzle-orm";

import { fbSyncLink, idempotency, news, outbox } from "@/db/schema";
import { db } from "@/lib/db";
import { getFacebookClient } from "@/lib/facebook";
import type { FacebookClient } from "@/lib/facebook";
import { FACEBOOK_PUBLISH_TOPIC, facebookSyncEnabled } from "@/lib/facebook/settings";
import { computeContentHash, mapOutboundPost } from "@/lib/facebook/outbound-content";
import { writeAudit } from "@/lib/pdpa/audit";

type FacebookPublishPayload = { newsId: string; fbSyncLinkId: string };
type Outcome = "published" | "skipped" | "failed";

const IDEMPOTENCY_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type DispatchResult = {
  drained: number;
  published: number;
  skipped: number;
  failed: number;
};

// The outbound push is a BACKGROUND JOB driven by the outbox (ADR-004/ADR-022), not a Server Action.
// It drains undispatched facebook.publish rows; on success it marks the outbox row dispatched, on
// failure it leaves the row for retry (at-least-once). The client is injectable so the same mock
// instance can be asserted across multiple drains in tests; production uses getFacebookClient().
export async function dispatchFacebookOutbox(
  client: FacebookClient = getFacebookClient(),
): Promise<DispatchResult> {
  const result: DispatchResult = { drained: 0, published: 0, skipped: 0, failed: 0 };

  // Kill-switch: when off, the worker no-ops and leaves rows for a later drain (ADR-022).
  if (!(await facebookSyncEnabled())) return result;

  const rows = await db
    .select({ id: outbox.id, payload: outbox.payload })
    .from(outbox)
    .where(and(eq(outbox.topic, FACEBOOK_PUBLISH_TOPIC), isNull(outbox.dispatchedAt)));

  for (const row of rows) {
    result.drained += 1;
    const outcome = await dispatchOne(row.id, row.payload as FacebookPublishPayload, client);
    result[outcome] += 1;
  }

  return result;
}

async function dispatchOne(
  outboxId: string,
  payload: FacebookPublishPayload,
  client: FacebookClient,
): Promise<Outcome> {
  const [article] = await db.select().from(news).where(eq(news.id, payload.newsId)).limit(1);

  // Defense-in-depth re-check of the public-only guard (ADR-022): never push a row that is no
  // longer public/published, even if it was when enqueued. A non-public row is dropped (dispatched,
  // not retried) and the link is marked failed so it never crosses.
  if (!article || article.visibility !== "public" || article.publishedAt === null) {
    await markDispatched(outboxId);
    await failLink(payload.fbSyncLinkId, payload.newsId, "not_public_at_dispatch");
    return "skipped";
  }

  const contentHash = computeContentHash({
    title: article.title,
    excerpt: article.excerpt,
    body: article.body,
    slug: article.slug,
  });

  return publishWithIdempotency(outboxId, payload, article, contentHash, client);
}

async function publishWithIdempotency(
  outboxId: string,
  payload: FacebookPublishPayload,
  article: typeof news.$inferSelect,
  contentHash: string,
  client: FacebookClient,
): Promise<Outcome> {
  // Idempotency keyed on content_hash: a retry of the SAME content reuses the recorded objectId so
  // the mock (or real Page) is never published to twice for one piece of content (loop prevention).
  const [seen] = await db
    .select({ response: idempotency.response })
    .from(idempotency)
    .where(eq(idempotency.key, contentHash))
    .limit(1);

  if (seen) {
    const objectId = (seen.response as { objectId: string } | null)?.objectId ?? null;
    await markSynced(payload.fbSyncLinkId, objectId, contentHash);
    await markDispatched(outboxId);
    return "published";
  }

  try {
    const { objectId } = await client.publishPost(mapOutboundPost(article));
    await db
      .insert(idempotency)
      .values({
        key: contentHash,
        fingerprint: contentHash,
        response: { objectId },
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      })
      .onConflictDoNothing({ target: idempotency.key });
    await markSynced(payload.fbSyncLinkId, objectId, contentHash);
    await markDispatched(outboxId);
    await writeAudit({
      actorUserId: null,
      action: "fb_sync_link.publish",
      resourceType: "fb_sync_link",
      resourceId: payload.fbSyncLinkId,
      metadata: { newsId: payload.newsId, contentHash, objectId, outcome: "synced" },
    });
    return "published";
  } catch (error) {
    // At-least-once: leave the outbox row undispatched for retry; mark the link failed.
    await failLink(payload.fbSyncLinkId, payload.newsId, errorMessage(error));
    return "failed";
  }
}

async function markSynced(
  linkId: string,
  objectId: string | null,
  contentHash: string,
): Promise<void> {
  await db
    .update(fbSyncLink)
    .set({
      fbObjectId: objectId,
      syncStatus: "synced",
      contentHash,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(fbSyncLink.id, linkId));
}

async function failLink(linkId: string, newsId: string, reason: string): Promise<void> {
  await db
    .update(fbSyncLink)
    .set({ syncStatus: "failed", updatedAt: new Date() })
    .where(eq(fbSyncLink.id, linkId));
  await writeAudit({
    actorUserId: null,
    action: "fb_sync_link.publish",
    resourceType: "fb_sync_link",
    resourceId: linkId,
    metadata: { newsId, reason, outcome: "failed" },
  });
}

async function markDispatched(outboxId: string): Promise<void> {
  await db.update(outbox).set({ dispatchedAt: new Date() }).where(eq(outbox.id, outboxId));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
