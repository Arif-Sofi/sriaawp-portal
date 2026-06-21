import {
  customType,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { news } from "./content";

// bytea column for the pgcrypto-encrypted Page token (mirrors student_profile.ic_no_encrypted,
// ADR-008/ADR-016). The value is written/read via pgp_sym_encrypt/pgp_sym_decrypt at the SQL
// boundary, so the Drizzle type only needs to round-trip the raw bytes.
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

// Outbound only in v1 (ADR-022). 'inbound' exists in the enum so the deferred Facebook->portal
// poller has a value to write, but no inbound code path is built in this issue.
export const fbSyncDirection = pgEnum("fb_sync_direction", ["outbound", "inbound"]);
export const fbSyncStatus = pgEnum("fb_sync_status", ["pending", "synced", "failed"]);

// Projection/state table (ADR-022): one row per (news item, direction). `outbox` is the delivery
// mechanism; this table is the state. content_hash drives dedup + edit-detection.
export const fbSyncLink = pgTable(
  "fb_sync_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portalNewsId: uuid("portal_news_id")
      .notNull()
      .references(() => news.id, { onDelete: "cascade" }),
    fbObjectId: text("fb_object_id"),
    direction: fbSyncDirection("direction").notNull(),
    contentHash: text("content_hash").notNull(),
    syncStatus: fbSyncStatus("sync_status").notNull().default("pending"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("fb_sync_link_portal_news_id_direction_unique").on(t.portalNewsId, t.direction),
    index("fb_sync_link_portal_news_id_idx").on(t.portalNewsId),
  ],
);

// Encrypted long-lived Page token store (ADR-008/ADR-016). The token is written encrypted via
// pgp_sym_encrypt with FACEBOOK_TOKEN_KEY and read via pgp_sym_decrypt; it is never stored
// plaintext and never in .env. The mock path never reads or networks this value.
export const fbCredential = pgTable("fb_credential", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: text("page_id"),
  pageTokenEncrypted: bytea("page_token_encrypted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
