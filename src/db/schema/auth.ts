import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// public.users is the 1:1 application anchor to Supabase auth.users (ADR-018):
// the uuid PK is reused, so every downstream FK survives the cut-over. The
// Auth.js adapter tables (accounts, sessions, verification_token,
// authenticators) are dropped in migration 0006. The "emailVerified" column is
// retained (see 0006 header).
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date", withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
