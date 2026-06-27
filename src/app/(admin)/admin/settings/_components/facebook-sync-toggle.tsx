"use client";

import { useState } from "react";

import { setFacebookSyncEnabled } from "@/app/actions/facebook";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

type FacebookSyncToggleProps = {
  enabled: boolean;
  locale: Locale;
};

export function FacebookSyncToggle({ enabled, locale }: FacebookSyncToggleProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [current, setCurrent] = useState(enabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setPending(true);
    setError(null);
    const result = await setFacebookSyncEnabled(!current);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrent(result.data.enabled);
  }

  return (
    <div className="flex items-center gap-3">
      <Badge variant={current ? "success" : "warning"}>
        {current ? t("admin.fb.enabled") : t("admin.fb.disabled")}
      </Badge>
      <Button variant="outline" size="sm" onClick={handleToggle} disabled={pending}>
        {current ? t("admin.fb.disable") : t("admin.fb.enable")}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
