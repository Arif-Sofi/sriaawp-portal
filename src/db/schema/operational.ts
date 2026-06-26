import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { news } from "./content";

export const chatRole = pgEnum("chat_role", ["user", "assistant", "system"]);
export const chatMode = pgEnum("chat_mode", ["in_article", "get_news", "manual_rag"]);
export const retrievalKind = pgEnum("retrieval_kind", ["vector", "get_news"]);

export const chatSession = pgTable(
  "chat_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [index("chat_session_user_id_idx").on(t.userId)],
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSession.id, { onDelete: "cascade" }),
    role: chatRole("role").notNull(),
    content: text("content").notNull(),
    // mode is the ADR-020 grounding discriminator; set on assistant turns, NULL on plain user/system rows.
    mode: chatMode("mode"),
    // news_id grounds Mode 1 (open article) and Mode 2 rows on a specific news item; NULL for Mode 3.
    newsId: uuid("news_id").references(() => news.id, { onDelete: "set null" }),
    citations: jsonb("citations"),
    latencyMs: integer("latency_ms"),
    refusedReason: text("refused_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_message_session_id_idx").on(t.sessionId)],
);

export const retrievalLog = pgTable(
  "retrieval_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // kind discriminates a Mode-3 vector retrieval from a Mode-2 get_news tool-call trace (ADR-020).
    kind: retrievalKind("kind").notNull(),
    queryText: text("query_text"),
    // chunk_ids / scores are the vector path; NULL for a get_news trace.
    chunkIds: uuid("chunk_ids").array(),
    scores: real("scores").array(),
    // tool_filters / result_ids are the get_news path; NULL for a vector retrieval.
    toolFilters: jsonb("tool_filters"),
    resultIds: uuid("result_ids").array(),
    model: text("model"),
    latencyMs: integer("latency_ms"),
    refusedReason: text("refused_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("retrieval_log_user_id_idx").on(t.userId)],
);

// Transactional outbox for at-least-once delivery (ADR-004).
// Reused by notification dispatch (ADR-021, issue #82) and Facebook egress (ADR-022, issue #85);
// do not build a parallel notification queue.
export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: text("topic").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  },
  (t) => [index("outbox_dispatched_at_idx").on(t.dispatchedAt)],
);

// Idempotency keys for documents.upload / events.create (ADR-004); also fb_sync_link egress (ADR-022).
export const idempotency = pgTable("idempotency", {
  key: text("key").primaryKey(),
  fingerprint: text("fingerprint").notNull(),
  response: jsonb("response"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
