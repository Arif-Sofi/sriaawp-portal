import { eq } from "drizzle-orm";

import { fbSyncLink } from "@/db/schema";
import { db } from "@/lib/db";

export type OutboundSyncStatus = "pending" | "synced" | "failed";

// Per-news-item outbound sync status for the admin surface. Keyed by portal_news_id so the row
// action can show the current fb_sync_link.sync_status next to each public post.
export const outboundSyncStatusByNewsId = async (): Promise<Map<string, OutboundSyncStatus>> => {
  const rows = await db
    .select({ newsId: fbSyncLink.portalNewsId, status: fbSyncLink.syncStatus })
    .from(fbSyncLink)
    .where(eq(fbSyncLink.direction, "outbound"));
  return new Map(rows.map((row) => [row.newsId, row.status]));
};
