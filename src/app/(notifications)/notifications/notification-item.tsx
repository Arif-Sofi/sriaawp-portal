"use client";

import { useState } from "react";

import { markNotificationRead } from "@/app/actions/engagement";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NotificationRow } from "@/lib/engagement/queries";
import { translate, type Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

type NotificationItemProps = {
  notification: NotificationRow;
  locale: Locale;
};

export function NotificationItem({ notification, locale }: NotificationItemProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState(notification.readAt !== null);

  async function handleMarkRead() {
    setPending(true);
    setError(null);
    const result = await markNotificationRead(notification.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRead(true);
  }

  const label =
    notification.type === "news_comment_received"
      ? t("engagement.notifReceived")
      : t("engagement.notifAnswered");

  return (
    <li className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {notification.createdAt.toLocaleString(locale === "ms" ? "ms-MY" : "en-GB")}
        </p>
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
      {read ? (
        <Badge variant="neutral">{t("engagement.read")}</Badge>
      ) : (
        <Button variant="outline" size="sm" onClick={handleMarkRead} disabled={pending}>
          {pending ? t("engagement.marking") : t("engagement.markRead")}
        </Button>
      )}
    </li>
  );
}
