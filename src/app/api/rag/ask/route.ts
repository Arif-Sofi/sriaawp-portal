import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isTextUIPart,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import type { AiMode, AiUiMessage, ChunkCitation } from "@/lib/ai/envelope";
import { generationModel } from "@/lib/ai/model";
import { embedQuery } from "@/lib/ai/embed";
import { loadManualCorpus } from "@/lib/ai/manual-retrieve";
import { rankByCosine, type RankedManualChunk } from "@/lib/ai/retrieve";
import { resolveManualImages } from "@/lib/storage/manual-images";
import { createGetNewsTool } from "@/lib/ai/tools/get-news";
import {
  recordAssistantTurn,
  recordGetNewsRetrieval,
  recordManualRagTurn,
  recordUserTurn,
  recordVectorRetrieval,
  resolveSession,
} from "@/lib/ai/persist";
import { extractGetNewsTrace, groundedNewsId } from "@/lib/ai/trace";
import { getVisibleNewsById, listVisibleNews } from "@/lib/content/queries";
import type { AuthedUser } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/rbac";

type AskRequestBody = {
  mode: AiMode;
  messages: UIMessage[];
  newsId?: string;
  sessionId?: string;
};

const STUDENT_ROLE = "student" as const;

function isStudentOnly(user: Pick<AuthedUser, "roles">): boolean {
  return user.roles.every((role) => role === STUDENT_ROLE);
}

function inArticleSystem(articleText: string): string {
  return [
    "Answer only from the article below. If the answer is not in it, say so.",
    "--- ARTICLE ---",
    articleText,
  ].join("\n");
}

const GET_NEWS_SYSTEM =
  "Use the get_news tool to fetch news the user may see, then answer grounded only on returned rows.";
const MANUAL_RAG_SYSTEM =
  "Answer from the retrieved manual sections provided as context, and only from them. Cite the section.";

// Grounded refusal shown when the top chunk falls below tau_refuse: the question
// is off-manual, so the assistant declines rather than letting the LLM guess.
const MANUAL_RAG_REFUSAL =
  "I can only answer questions about using the portal, and I couldn't find that in the manual.";

const SESSION_HEADER = "x-session-id";

function sessionHeader(sessionId: string): Record<string, string> {
  return { [SESSION_HEADER]: sessionId };
}

function lastUserText(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUser) return "";
  return lastUser.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

function citationsFor(chunks: RankedManualChunk[]): ChunkCitation[] {
  return chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    manualSection: chunk.sectionHeading,
    score: chunk.score,
  }));
}

function groundingContext(chunks: RankedManualChunk[]): string {
  const sections = chunks
    .map((chunk) => `## ${chunk.sectionHeading}\n${chunk.content}`)
    .join("\n\n");
  return `Manual sections:\n${sections}`;
}

async function manualRagResponse(
  body: AskRequestBody,
  user: AuthedUser,
  sessionId: string,
): Promise<Response> {
  const startedMs = Date.now();
  const queryText = lastUserText(body.messages);
  const queryEmbedding = await embedQuery(queryText);
  const ranked = rankByCosine(queryEmbedding, await loadManualCorpus());
  const retrievalLatencyMs = Date.now() - startedMs;

  if (!ranked.grounded) {
    await recordVectorRetrieval({
      userId: user.id,
      queryText,
      chunkIds: [],
      scores: [],
      latencyMs: retrievalLatencyMs,
      refusedReason: ranked.reason,
    });
    await recordManualRagTurn({
      sessionId,
      content: MANUAL_RAG_REFUSAL,
      citations: [],
      latencyMs: retrievalLatencyMs,
      refusedReason: ranked.reason,
    });
    return manualRagRefusalStream(sessionId);
  }

  const chunks = ranked.chunks;
  await recordVectorRetrieval({
    userId: user.id,
    queryText,
    chunkIds: chunks.map((chunk) => chunk.chunkId),
    scores: chunks.map((chunk) => chunk.score),
    latencyMs: retrievalLatencyMs,
    refusedReason: null,
  });

  const citations = citationsFor(chunks);
  const imageLinks = await resolveManualImages(chunks.flatMap((chunk) => chunk.imageLinks));

  const stream = createUIMessageStream<AiUiMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "data-image-links", data: imageLinks });
      writer.write({ type: "data-citations", data: citations });

      const result = streamText({
        model: generationModel,
        system: MANUAL_RAG_SYSTEM,
        messages: [
          { role: "system", content: groundingContext(chunks) },
          ...(await convertToModelMessages(body.messages)),
        ],
        onFinish: async ({ text }) => {
          await recordManualRagTurn({
            sessionId,
            content: text,
            citations,
            latencyMs: Date.now() - startedMs,
            refusedReason: null,
          });
        },
      });
      writer.merge(result.toUIMessageStream<AiUiMessage>());
    },
  });
  return createUIMessageStreamResponse({ stream, headers: sessionHeader(sessionId) });
}

function manualRagRefusalStream(sessionId: string): Response {
  const stream = createUIMessageStream<AiUiMessage>({
    execute: ({ writer }) => {
      writer.write({ type: "data-image-links", data: [] });
      writer.write({ type: "data-citations", data: [] });
      writer.write({ type: "text-start", id: "refusal" });
      writer.write({ type: "text-delta", id: "refusal", delta: MANUAL_RAG_REFUSAL });
      writer.write({ type: "text-end", id: "refusal" });
    },
  });
  return createUIMessageStreamResponse({ stream, headers: sessionHeader(sessionId) });
}

async function inArticleResponse(
  body: AskRequestBody,
  user: AuthedUser,
  sessionId: string,
): Promise<Response> {
  if (!body.newsId) return Response.json({ error: "newsId is required" }, { status: 400 });

  const article = await getVisibleNewsById(body.newsId, user);
  if (!article) return Response.json({ error: "article not found" }, { status: 404 });

  const startedMs = Date.now();
  const result = streamText({
    model: generationModel,
    system: inArticleSystem(article.body),
    messages: await convertToModelMessages(body.messages),
    onFinish: async ({ text }) => {
      await recordAssistantTurn({
        sessionId,
        mode: "in_article",
        content: text,
        newsId: article.id,
        latencyMs: Date.now() - startedMs,
      });
    },
  });
  return result.toUIMessageStreamResponse<AiUiMessage>({ headers: sessionHeader(sessionId) });
}

async function getNewsResponse(
  body: AskRequestBody,
  user: AuthedUser,
  sessionId: string,
): Promise<Response> {
  const startedMs = Date.now();
  const result = streamText({
    model: generationModel,
    system: GET_NEWS_SYSTEM,
    messages: await convertToModelMessages(body.messages),
    tools: { get_news: createGetNewsTool(user, listVisibleNews) },
    stopWhen: stepCountIs(5),
    onFinish: async ({ text, steps }) => {
      const trace = extractGetNewsTrace(steps);
      const latencyMs = Date.now() - startedMs;
      await recordAssistantTurn({
        sessionId,
        mode: "get_news",
        content: text,
        newsId: groundedNewsId(trace),
        latencyMs,
      });
      if (trace) await recordGetNewsRetrieval({ userId: user.id, trace, latencyMs });
    },
  });
  return result.toUIMessageStreamResponse<AiUiMessage>({ headers: sessionHeader(sessionId) });
}

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "authentication required" }, { status: 401 });
  if (isStudentOnly(user)) {
    return Response.json(
      { error: "AI assistant is not available to students in v1" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as AskRequestBody;

  const sessionId = await resolveSession(user.id, body.sessionId);
  await recordUserTurn(sessionId, lastUserText(body.messages));

  if (body.mode === "manual_rag") return manualRagResponse(body, user, sessionId);
  if (body.mode === "in_article") return inArticleResponse(body, user, sessionId);
  return getNewsResponse(body, user, sessionId);
}
