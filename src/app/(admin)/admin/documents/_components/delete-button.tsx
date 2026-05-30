"use client";

import { useState } from "react";

import { deleteDocument } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

type DeleteButtonProps = {
  documentId: string;
  locale: Locale;
};

export function DeleteButton({ documentId, locale }: DeleteButtonProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await deleteDocument(documentId);
    setPending(false);
  }

  return (
    <Button variant="destructive" size="sm" disabled={pending} onClick={handleClick}>
      {t("documents.delete")}
    </Button>
  );
}
