import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { departments } from "./departments";

export const eventPriority = pgEnum("event_priority", ["normal", "exam"]);
export const eventStatus = pgEnum("event_status", [
  "draft",
  "published",
  "pending_review",
  "cancelled",
]);
export const audienceType = pgEnum("audience_type", ["public", "role", "department"]);
export const blackoutScope = pgEnum("blackout_scope", ["school", "department"]);

export const room = pgTable("room", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const event = pgTable("event", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  allDay: boolean("all_day").notNull().default(false),
  roomId: uuid("room_id").references(() => room.id, { onDelete: "set null" }),
  organizerUserId: uuid("organizer_user_id").references(() => users.id, { onDelete: "set null" }),
  deptId: uuid("dept_id").references(() => departments.id, { onDelete: "set null" }),
  priority: eventPriority("priority").notNull().default("normal"),
  status: eventStatus("status").notNull().default("published"),
  rrule: text("rrule"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventOccurrence = pgTable(
  "event_occurrence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("event_occurrence_start_at_idx").on(t.startAt),
    index("event_occurrence_event_id_idx").on(t.eventId),
  ],
);

export const eventAudience = pgTable(
  "event_audience",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    audienceType: audienceType("audience_type").notNull(),
    audienceRef: text("audience_ref"),
  },
  (t) => [index("event_audience_event_id_idx").on(t.eventId)],
);

export const blackoutWindow = pgTable("blackout_window", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  scope: blackoutScope("scope").notNull(),
  deptId: uuid("dept_id").references(() => departments.id, { onDelete: "cascade" }),
  isHard: boolean("is_hard").notNull().default(true),
  rrule: text("rrule"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
