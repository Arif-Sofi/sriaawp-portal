import { eq } from "drizzle-orm";

import { appSetting } from "@/db/schema";
import { db } from "@/lib/db";

export const FACEBOOK_SYNC_ENABLED_KEY = "facebook_sync_enabled";

// The outbox topic the enqueue action writes and the worker drains. Lives here (a plain module) so
// the "use server" action file can stay export-only-async-functions for the Server Actions boundary.
export const FACEBOOK_PUBLISH_TOPIC = "facebook.publish";

// Global kill-switch (ADR-022). Default OFF (seeded false): when off, both enqueue and the outbox
// worker no-op so nothing crosses to the Page. The key is read at every boundary, not cached, so a
// flip takes effect immediately.
export const facebookSyncEnabled = async (): Promise<boolean> => {
  const [row] = await db
    .select({ value: appSetting.value })
    .from(appSetting)
    .where(eq(appSetting.key, FACEBOOK_SYNC_ENABLED_KEY))
    .limit(1);
  return row?.value === true;
};
