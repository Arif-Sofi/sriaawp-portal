import { readUIMessageStream, type UIMessageChunk } from "ai";

import type { AiMode, AiUiMessage } from "@/lib/ai/envelope";

export type AskInput = {
  mode: AiMode;
  messages: AiUiMessage[];
  newsId?: string;
  sessionId?: string;
};

const DATA_PREFIX = "data: ";

/**
 * Parses the `/api/rag/ask` SSE body into AI SDK UI-message chunks. Each SSE
 * event is a single `data: <json>` line; chunks may straddle network reads, so a
 * carry buffer holds the partial tail until its terminating blank line arrives.
 */
function sseToChunks(body: ReadableStream<Uint8Array>): ReadableStream<UIMessageChunk> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      for (const line of decoder.decode(value, { stream: true }).split("\n")) {
        if (!line.startsWith(DATA_PREFIX)) continue;
        const payload = line.slice(DATA_PREFIX.length).trim();
        if (payload && payload !== "[DONE]") controller.enqueue(JSON.parse(payload));
      }
    },
  });
}

/**
 * POSTs a turn and yields the reconstructed assistant UI message as it streams.
 * The route refuses (4xx) before any token when the caller cannot see the article
 * or is not permitted the assistant; surface that as an error.
 */
export async function* askStream(
  input: AskInput,
  onSession?: (sessionId: string) => void,
): AsyncGenerator<AiUiMessage> {
  const response = await fetch("/api/rag/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok || !response.body) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(message || `request failed (${response.status})`);
  }
  const sessionId = response.headers.get("x-session-id");
  if (sessionId && onSession) onSession(sessionId);
  yield* readUIMessageStream<AiUiMessage>({ stream: sseToChunks(response.body) });
}

export function messageText(message: AiUiMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("");
}
