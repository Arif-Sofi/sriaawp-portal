import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { departments } from "./departments";
import { users } from "./auth";

export const contentVisibility = pgEnum("content_visibility", ["public", "internal", "role_list"]);

export const news = pgTable("news", {
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
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
