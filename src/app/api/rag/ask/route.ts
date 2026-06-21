import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isTextUIPart,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import type { AiMode, AiUiMessage } from "@/lib/ai/envelope";
import { generationModel } from "@/lib/ai/model";
import { citationFor, STUBBED_MANUAL_CHUNK } from "@/lib/ai/manual-stub";
import { createGetNewsTool } from "@/lib/ai/tools/get-news";
import {
  recordAssistantTurn,
  recordGetNewsRetrieval,
  recordUserTurn,
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
  "Answer from the retrieved manual section provided as context. Cite the section.";

function lastUserText(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUser) return "";
  return lastUser.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

function manualRagResponse(body: AskRequestBody): Response {
  const chunk = STUBBED_MANUAL_CHUNK;
  const stream = createUIMessageStream<AiUiMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "data-image-links", data: chunk.imageLinks });
      writer.write({ type: "data-citations", data: [citationFor(chunk)] });

      const result = streamText({
        model: generationModel,
        system: MANUAL_RAG_SYSTEM,
        messages: [
          { role: "system", content: `Manual section:\n${chunk.text}` },
          ...(await convertToModelMessages(body.messages)),
        ],
      });
      writer.merge(result.toUIMessageStream<AiUiMessage>());
    },
  });
  return createUIMessageStreamResponse({ stream });
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
  return result.toUIMessageStreamResponse<AiUiMessage>();
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
  return result.toUIMessageStreamResponse<AiUiMessage>();
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

  if (body.mode === "manual_rag") return manualRagResponse(body);

  const sessionId = await resolveSession(user.id, body.sessionId);
  await recordUserTurn(sessionId, lastUserText(body.messages));

  if (body.mode === "in_article") return inArticleResponse(body, user, sessionId);
  return getNewsResponse(body, user, sessionId);
}
