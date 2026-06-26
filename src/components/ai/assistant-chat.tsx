"use client";

import { useState } from "react";

import { ChatBubble } from "@/components/ui/chat-bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/loading";
import { askStream, messageText, type AskInput } from "@/lib/ai/client-stream";
import type { AiMode, AiUiMessage } from "@/lib/ai/envelope";
import { translate, type Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

type Turn = { role: "user" | "assistant"; text: string };

type AssistantChatProps = {
  mode: AiMode;
  newsId?: string;
  locale: Locale;
};

function userMessage(text: string): AiUiMessage {
  return { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] };
}

export function AssistantChat({ mode, newsId, locale }: AssistantChatProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  const t = (key: string) => translate(ui, key, locale);

  async function send() {
    const prompt = draft.trim();
    if (!prompt || isBusy) return;

    const history = [...turns, { role: "user" as const, text: prompt }];
    setTurns([...history, { role: "assistant", text: "" }]);
    setDraft("");
    setError(null);
    setIsBusy(true);

    const payload: AskInput = {
      mode,
      newsId,
      sessionId,
      messages: history
        .filter((turn) => turn.text)
        .map((turn) =>
          turn.role === "user"
            ? userMessage(turn.text)
            : {
                id: crypto.randomUUID(),
                role: "assistant",
                parts: [{ type: "text", text: turn.text }],
              },
        ),
    };

    try {
      for await (const message of askStream(payload, setSessionId)) {
        const text = messageText(message);
        setTurns((prev) =>
          prev.map((turn, i) => (i === prev.length - 1 ? { ...turn, text } : turn)),
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("assistant.error"));
      setTurns((prev) => prev.slice(0, -1));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2" aria-live="polite">
        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("assistant.empty")}</p>
        ) : null}
        {turns.map((turn, i) => (
          <ChatBubble key={i} role={turn.role}>
            {turn.text || <Spinner size="sm" />}
          </ChatBubble>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("assistant.placeholder")}
          rows={2}
          disabled={isBusy}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isBusy || !draft.trim()}>
            {isBusy ? t("assistant.sending") : t("assistant.send")}
          </Button>
        </div>
      </form>
    </div>
  );
}
