import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import type { AiMode, AiUiMessage } from "@/lib/ai/envelope";
import { generationModel } from "@/lib/ai/model";
import { citationFor, STUBBED_MANUAL_CHUNK } from "@/lib/ai/manual-stub";
import { createGetNewsTool } from "@/lib/ai/tools/get-news";
import { listVisibleNews } from "@/lib/content/queries";
import type { AuthedUser } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/rbac";

type AskRequestBody = {
  mode: AiMode;
  messages: UIMessage[];
  articleText?: string;
  newsId?: string;
};

const STUDENT_ROLE = "student" as const;

function isStudentOnly(user: Pick<AuthedUser, "roles">): boolean {
  return user.roles.every((role) => role === STUDENT_ROLE);
}

function systemFor(mode: AiMode, articleText: string | undefined): string {
  if (mode === "in_article") {
    return [
      "Answer only from the article below. If the answer is not in it, say so.",
      "--- ARTICLE ---",
      articleText ?? "",
    ].join("\n");
  }
  if (mode === "get_news") {
    return "Use the get_news tool to fetch news the user may see, then answer grounded only on returned rows.";
  }
  return "Answer from the retrieved manual section provided as context. Cite the section.";
}

async function streamWithTextOnly(body: AskRequestBody, system: string, user: AuthedUser) {
  const tools =
    body.mode === "get_news" ? { get_news: createGetNewsTool(user, listVisibleNews) } : undefined;

  return streamText({
    model: generationModel,
    system,
    messages: await convertToModelMessages(body.messages),
    tools,
    stopWhen: stepCountIs(5),
  });
}

function manualRagResponse(body: AskRequestBody): Response {
  const chunk = STUBBED_MANUAL_CHUNK;
  const stream = createUIMessageStream<AiUiMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "data-image-links", data: chunk.imageLinks });
      writer.write({ type: "data-citations", data: [citationFor(chunk)] });

      const result = streamText({
        model: generationModel,
        system: systemFor("manual_rag", undefined),
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

  const result = await streamWithTextOnly(body, systemFor(body.mode, body.articleText), user);
  return result.toUIMessageStreamResponse<AiUiMessage>();
}
