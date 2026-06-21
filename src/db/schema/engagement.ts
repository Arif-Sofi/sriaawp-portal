import {
  type AnyPgColumn,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { news } from "./content";

export const reactionType = pgEnum("reaction_type", ["like"]);
export const commentStatus = pgEnum("comment_status", ["visible", "hidden", "deleted"]);
export const notificationType = pgEnum("notification_type", [
  "news_comment_received",
  "news_comment_answered",
]);

// Engagement child rows carry NO visibility column; they inherit the parent news
// item's {public, internal, role_list} scope by FK join (ADR-021, revising ADR-010).
export const newsReaction = pgTable(
  "news_reaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    newsId: uuid("news_id")
      .notNull()
      .references(() => news.id, { onDelete: "cascade" }),
    // Nullable + ON DELETE SET NULL for DSAR anonymise-on-erasure (ADR-008): a NOT NULL
    // column cannot be SET NULL, so the column is nullable and an orphaned reaction is
    // pruned by the application, not the FK.
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    reactionType: reactionType("reaction_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("news_reaction_news_id_user_id_reaction_type_unique").on(
      t.newsId,
      t.userId,
      t.reactionType,
    ),
    index("news_reaction_news_id_idx").on(t.newsId),
  ],
);

export const newsComment = pgTable(
  "news_comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    newsId: uuid("news_id")
      .notNull()
      .references(() => news.id, { onDelete: "cascade" }),
    // Self-FK; non-null ONLY for a teacher reply to a parent question (the single permitted
    // level). One-level enforcement lives in a BEFORE INSERT OR UPDATE trigger (migration 0009)
    // because a column CHECK cannot inspect the referenced parent row.
    parentCommentId: uuid("parent_comment_id").references((): AnyPgColumn => newsComment.id, {
      onDelete: "cascade",
    }),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    status: commentStatus("status").notNull().default("visible"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("news_comment_news_id_idx").on(t.newsId),
    index("news_comment_parent_comment_id_idx").on(t.parentCommentId),
  ],
);

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notification_recipient_user_id_idx").on(t.recipientUserId)],
);

// Generic admin-configurable settings. Seeded with allow_student_comments=false (default OFF);
// the #83 UI/server-action layer reads this key at the call site to decide whether a Student
// may comment or react (extends ADR-021's "Student react TBD" under the same admin control).
export const appSetting = pgTable("app_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
