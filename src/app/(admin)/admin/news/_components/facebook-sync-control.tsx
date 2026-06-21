"use client";

import { useState } from "react";

import { enqueueFacebookSync } from "@/app/actions/facebook";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import type { OutboundSyncStatus } from "@/lib/facebook/queries";

type FacebookSyncControlProps = {
  newsId: string;
  status: OutboundSyncStatus | null;
  locale: Locale;
};

const STATUS_KEY: Record<OutboundSyncStatus, string> = {
  pending: "admin.fb.statusPending",
  synced: "admin.fb.statusSynced",
  failed: "admin.fb.statusFailed",
};

const STATUS_VARIANT: Record<OutboundSyncStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  synced: "success",
  failed: "destructive",
};

export function FacebookSyncControl({ newsId, status, locale }: FacebookSyncControlProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [pending, setPending] = useState(false);
  const [current, setCurrent] = useState<OutboundSyncStatus | null>(status);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setPending(true);
    setError(null);
    const result = await enqueueFacebookSync(newsId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.data.status === "pending") setCurrent("pending");
  }

  return (
    <div className="flex items-center gap-2">
      {current ? <Badge variant={STATUS_VARIANT[current]}>{t(STATUS_KEY[current])}</Badge> : null}
      <Button variant="outline" size="sm" onClick={handleSync} disabled={pending}>
        {pending ? t("admin.fb.syncing") : t("admin.fb.sync")}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
