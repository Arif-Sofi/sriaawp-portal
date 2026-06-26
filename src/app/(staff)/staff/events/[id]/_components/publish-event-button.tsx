"use client";

import { useState } from "react";

import { publishPendingEvent } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

type PublishEventButtonProps = {
  id: string;
  locale: Locale;
};

export function PublishEventButton({ id, locale }: PublishEventButtonProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const result = await publishPendingEvent(id);
    setPending(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <div>
      <Button variant="primary" size="md" disabled={pending} onClick={handleClick}>
        {pending ? t("event.publishing") : t("event.publish")}
      </Button>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
