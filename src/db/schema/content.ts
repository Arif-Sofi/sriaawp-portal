import { boolean, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { departments } from "./departments";
import { users } from "./auth";

export const contentVisibility = pgEnum("content_visibility", ["public", "internal", "role_list"]);

// Loop-prevention for the Facebook bridge (ADR-022): a portal-authored row is 'portal' with a NULL
// external_id; a (deferred) Facebook-ingested row is 'facebook' carrying its Page object id. The
// UNIQUE(origin, external_id) makes "ingest a Facebook post at most once" an explicit invariant —
// Postgres treats multiple NULLs as distinct, so portal rows are unaffected.
export const newsOrigin = pgEnum("news_origin", ["portal", "facebook"]);

export const news = pgTable(
  "news",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    excerpt: text("excerpt"),
    body: text("body").notNull(),
    visibility: contentVisibility("visibility").notNull().default("public"),
    visibilityRoles: text("visibility_roles").array(),
    deptId: uuid("dept_id").references(() => departments.id, { onDelete: "set null" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    origin: newsOrigin("origin").notNull().default("portal"),
    externalId: text("external_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("news_origin_external_id_unique").on(t.origin, t.externalId)],
);

export const memo = pgTable("memo", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  visibility: contentVisibility("visibility").notNull().default("internal"),
  visibilityRoles: text("visibility_roles").array(),
  deptId: uuid("dept_id").references(() => departments.id, { onDelete: "set null" }),
  authorUserId: uuid("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  pinned: boolean("pinned").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
