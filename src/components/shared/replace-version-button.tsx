"use client";

import { useState } from "react";

import { replaceVersion } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form/field";
import { Input } from "@/components/ui/input";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import type { ActionResult } from "@/lib/utils/result";

type ReplaceVersionButtonProps = {
  documentId: string;
  locale: Locale;
};

type FormState = ActionResult<unknown> | null;

export function ReplaceVersionButton({ documentId, locale }: ReplaceVersionButtonProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<FormState>(null);

  function handleClose() {
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const result = await replaceVersion(documentId, formData);
    setState(result);
    setPending(false);
    if (!result.ok) return;
    setOpen(false);
    form.reset();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("documents.replace")}
      </Button>
      <Dialog open={open} onClose={handleClose} title={t("documents.replaceTitle")}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label={t("documents.fieldFile")}
            error={!state?.ok ? state?.fieldErrors?.file : undefined}
          >
            <Input type="file" name="file" accept=".pdf,.docx,.xlsx,.txt,.md" required />
          </Field>

          {!state?.ok && state?.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={handleClose}>
              {t("admin.content.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("documents.replacing") : t("documents.replace")}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
