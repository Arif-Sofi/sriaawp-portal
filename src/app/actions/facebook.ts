"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { appSetting, fbSyncLink, news, outbox } from "@/db/schema";
import { db } from "@/lib/db";
import { computeContentHash, type OutboundNews } from "@/lib/facebook/outbound-content";
import {
  FACEBOOK_PUBLISH_TOPIC,
  FACEBOOK_SYNC_ENABLED_KEY,
  facebookSyncEnabled,
} from "@/lib/facebook/settings";
import { writeAudit } from "@/lib/pdpa/audit";
import { requirePermission } from "@/lib/rbac";
import { fail, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";

// PUBLIC-ONLY GUARD (load-bearing, ADR-022 / R-04). A POSITIVE allow-list: a row crosses to the
// public Page ONLY when it is visibility='public' AND published. internal/role_list are rejected
// here and re-checked in the worker (defense in depth). This is a safety control, not a filter:
// a leak of internal/role_list to a public Page is a confidentiality + PDPA breach.
const isPublicPublished = (row: {
  visibility: "public" | "internal" | "role_list";
  publishedAt: Date | null;
}): boolean => row.visibility === "public" && row.publishedAt !== null;

type NewsRow = typeof news.$inferSelect;

const toOutbound = (row: NewsRow): OutboundNews => ({
  title: row.title,
  excerpt: row.excerpt,
  body: row.body,
  slug: row.slug,
});

export async function enqueueFacebookSync(
  newsId: string,
): Promise<ActionResult<{ status: string }>> {
  const user = await requirePermission("news:sync_facebook");

  if (!(await facebookSyncEnabled())) {
    return fail("Facebook sync is disabled", { code: "SYNC_DISABLED" });
  }

  const [row] = await db.select().from(news).where(eq(news.id, newsId)).limit(1);
  if (!row) return fail("News post not found", { code: "NOT_FOUND" });

  // Positive allow-list boundary: internal / role_list / unpublished are hard-rejected.
  if (!isPublicPublished(row)) {
    return fail("Only public, published news may be synced to Facebook", {
      code: "NOT_PUBLIC",
    });
  }

  const contentHash = computeContentHash(toOutbound(row));

  const [existing] = await db
    .select()
    .from(fbSyncLink)
    .where(and(eq(fbSyncLink.portalNewsId, newsId), eq(fbSyncLink.direction, "outbound")))
    .limit(1);

  // Re-enqueue of an UNCHANGED, already-synced post is a no-op (dedup via content_hash).
  if (existing && existing.syncStatus === "synced" && existing.contentHash === contentHash) {
    return ok({ status: "unchanged" });
  }

  const linkId = await upsertOutboundLink(newsId, contentHash, existing?.id);

  await db.insert(outbox).values({
    topic: FACEBOOK_PUBLISH_TOPIC,
    payload: { newsId, fbSyncLinkId: linkId },
  });

  await writeAudit({
    actorUserId: user.id,
    action: "fb_sync_link.enqueue",
    resourceType: "fb_sync_link",
    resourceId: linkId,
    metadata: { newsId, contentHash },
  });

  revalidatePath("/admin/news");
  return ok({ status: "pending" });
}

async function upsertOutboundLink(
  newsId: string,
  contentHash: string,
  existingId?: string,
): Promise<string> {
  if (existingId) {
    await db
      .update(fbSyncLink)
      .set({ contentHash, syncStatus: "pending", updatedAt: new Date() })
      .where(eq(fbSyncLink.id, existingId));
    return existingId;
  }
  const [created] = await db
    .insert(fbSyncLink)
    .values({ portalNewsId: newsId, direction: "outbound", contentHash, syncStatus: "pending" })
    .returning({ id: fbSyncLink.id });
  return created.id;
}

export async function setFacebookSyncEnabled(
  enabled: boolean,
): Promise<ActionResult<{ enabled: boolean }>> {
  const user = await requirePermission("admin:settings:manage");

  await db
    .insert(appSetting)
    .values({ key: FACEBOOK_SYNC_ENABLED_KEY, value: enabled, updatedBy: user.id })
    .onConflictDoUpdate({
      target: appSetting.key,
      set: { value: enabled, updatedBy: user.id, updatedAt: new Date() },
    });

  await writeAudit({
    actorUserId: user.id,
    action: "app_setting.facebook_sync_enabled",
    resourceType: "app_setting",
    resourceId: FACEBOOK_SYNC_ENABLED_KEY,
    metadata: { enabled },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/news");
  return ok({ enabled });
}
