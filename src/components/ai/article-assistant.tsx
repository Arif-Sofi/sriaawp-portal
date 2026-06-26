"use client";

import { useState } from "react";

import { AssistantChat } from "@/components/ai/assistant-chat";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translate, type Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

type ArticleAssistantProps = {
  newsId: string;
  locale: Locale;
};

export function ArticleAssistant({ newsId, locale }: ArticleAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = (key: string) => translate(ui, key, locale);

  if (!isOpen) {
    return (
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        {t("assistant.askArticle")}
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <AssistantChat mode="in_article" newsId={newsId} locale={locale} />
      </CardContent>
    </Card>
  );
}
