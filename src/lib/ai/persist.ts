import { and, eq } from "drizzle-orm";

import { chatMessage, chatSession, retrievalLog } from "@/db/schema";
import { db } from "@/lib/db";
import type { GetNewsFilters, GetNewsRow } from "@/lib/ai/tools/get-news";
import { GENERATION_MODEL_ID } from "@/lib/ai/model";
import type { AiMode, ChunkCitation } from "@/lib/ai/envelope";

export type GetNewsTrace = {
  filters: GetNewsFilters;
  results: GetNewsRow[];
};

/**
 * Resolves the chat_session for a turn: reuses the caller's own session when a
 * valid id is supplied, otherwise opens a fresh one. The ownership check stops a
 * caller from appending to another user's session by guessing its id.
 */
export async function resolveSession(
  userId: string,
  sessionId: string | undefined,
): Promise<string> {
  if (sessionId) {
    const [owned] = await db
      .select({ id: chatSession.id })
      .from(chatSession)
      .where(and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)))
      .limit(1);
    if (owned) return owned.id;
  }
  const [created] = await db
    .insert(chatSession)
    .values({ userId })
    .returning({ id: chatSession.id });
  return created.id;
}

export async function recordUserTurn(sessionId: string, content: string): Promise<void> {
  await db.insert(chatMessage).values({ sessionId, role: "user", content });
}

type AssistantTurn = {
  sessionId: string;
  mode: AiMode;
  content: string;
  newsId: string | null;
  latencyMs: number;
};

export async function recordAssistantTurn(turn: AssistantTurn): Promise<void> {
  await db.insert(chatMessage).values({
    sessionId: turn.sessionId,
    role: "assistant",
    content: turn.content,
    mode: turn.mode,
    newsId: turn.newsId,
    latencyMs: turn.latencyMs,
  });
}

type RetrievalEntry = {
  userId: string;
  trace: GetNewsTrace;
  latencyMs: number;
};

export async function recordGetNewsRetrieval(entry: RetrievalEntry): Promise<void> {
  await db.insert(retrievalLog).values({
    userId: entry.userId,
    kind: "get_news",
    toolFilters: entry.trace.filters,
    resultIds: entry.trace.results.map((row) => row.id),
    model: GENERATION_MODEL_ID,
    latencyMs: entry.latencyMs,
  });
}

type ManualRagTurn = {
  sessionId: string;
  content: string;
  citations: ChunkCitation[];
  latencyMs: number;
  refusedReason: string | null;
};

/**
 * Mode-3 assistant turn. news_id is always NULL (the manual is not a news item);
 * citations carry the ranked chunk refs; refused_reason is set on a tau_refuse
 * refusal so a grounded refusal is distinguishable from a grounded answer.
 */
export async function recordManualRagTurn(turn: ManualRagTurn): Promise<void> {
  await db.insert(chatMessage).values({
    sessionId: turn.sessionId,
    role: "assistant",
    content: turn.content,
    mode: "manual_rag",
    newsId: null,
    citations: turn.citations,
    latencyMs: turn.latencyMs,
    refusedReason: turn.refusedReason,
  });
}

type VectorRetrievalEntry = {
  userId: string;
  queryText: string;
  chunkIds: string[];
  scores: number[];
  latencyMs: number;
  refusedReason: string | null;
};

/**
 * Mode-3 vector retrieval trace: the flat-scan ranking outcome. On a refusal the
 * ranked chunk_ids/scores are empty and refused_reason carries the gate reason.
 */
export async function recordVectorRetrieval(entry: VectorRetrievalEntry): Promise<void> {
  await db.insert(retrievalLog).values({
    userId: entry.userId,
    kind: "vector",
    queryText: entry.queryText,
    chunkIds: entry.chunkIds,
    scores: entry.scores,
    model: GENERATION_MODEL_ID,
    latencyMs: entry.latencyMs,
    refusedReason: entry.refusedReason,
  });
}
