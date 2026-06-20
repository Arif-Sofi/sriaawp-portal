"use client";

import { useState } from "react";

import { updateEvent } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

type EventEditFormProps = {
  id: string;
  title: string;
  description: string | null;
  locale: Locale;
};

export function EventEditForm({ id, title, description, locale }: EventEditFormProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setTitleError(null);
    setSaved(false);

    const data = new FormData(e.currentTarget);
    const result = await updateEvent(id, {
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setTitleError(result.fieldErrors?.title ?? null);
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label={t("event.title")} htmlFor="event-edit-title">
        <Input id="event-edit-title" name="title" defaultValue={title} required />
        {titleError ? <p className="mt-1 text-xs text-destructive">{titleError}</p> : null}
      </Field>

      <Field label={t("event.description")} htmlFor="event-edit-description">
        <Textarea
          id="event-edit-description"
          name="description"
          rows={4}
          defaultValue={description ?? ""}
        />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-success">{t("event.detailsSaved")}</p> : null}

      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? t("event.savingDetails") : t("event.saveDetails")}
      </Button>
    </form>
  );
}
