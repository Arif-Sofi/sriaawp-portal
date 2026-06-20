"use client";

import { useState } from "react";

import { createNews } from "@/app/actions/news";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import type { ActionResult } from "@/lib/utils/result";

type NewsVisibility = "public" | "internal" | "role_list";

type FormState = ActionResult<unknown> | null;

type AdminNewsFormProps = {
  locale: Locale;
};

function parseRoles(value: string): string[] | undefined {
  const roles = value
    .split(",")
    .map((role) => role.trim())
    .filter((role) => role.length > 0);
  if (roles.length === 0) return undefined;
  return roles;
}

export function AdminNewsForm({ locale }: AdminNewsFormProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [state, setState] = useState<FormState>(null);
  const [pending, setPending] = useState(false);
  const [visibility, setVisibility] = useState<NewsVisibility>("public");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const result = await createNews({
      title: String(data.get("title") ?? ""),
      body: String(data.get("body") ?? ""),
      excerpt: String(data.get("excerpt") ?? "") || undefined,
      visibility,
      visibilityRoles:
        visibility === "role_list"
          ? parseRoles(String(data.get("visibilityRoles") ?? ""))
          : undefined,
    });

    setState(result);
    setPending(false);
    if (!result.ok) return;
    form.reset();
    setVisibility("public");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label={t("admin.news.fieldTitle")}
        htmlFor="news-title"
        error={!state?.ok ? state?.fieldErrors?.title : undefined}
      >
        <Input
          id="news-title"
          name="title"
          placeholder={t("admin.news.fieldTitlePlaceholder")}
          required
        />
      </Field>

      <Field label={t("admin.news.fieldExcerpt")} htmlFor="news-excerpt">
        <Input
          id="news-excerpt"
          name="excerpt"
          placeholder={t("admin.news.fieldExcerptPlaceholder")}
        />
      </Field>

      <Field
        label={t("admin.news.fieldBody")}
        htmlFor="news-body"
        error={!state?.ok ? state?.fieldErrors?.body : undefined}
      >
        <Textarea
          id="news-body"
          name="body"
          rows={6}
          placeholder={t("admin.news.fieldBodyPlaceholder")}
          required
        />
      </Field>

      <Field label={t("admin.content.fieldVisibility")} htmlFor="news-visibility">
        <Select
          id="news-visibility"
          name="visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as NewsVisibility)}
        >
          <option value="public">{t("admin.content.visibilityPublic")}</option>
          <option value="internal">{t("admin.content.visibilityInternal")}</option>
          <option value="role_list">{t("admin.content.visibilityRoleList")}</option>
        </Select>
      </Field>

      {visibility === "role_list" ? (
        <Field label={t("admin.content.fieldVisibilityRoles")} htmlFor="news-visibility-roles">
          <Input id="news-visibility-roles" name="visibilityRoles" placeholder="teacher, admin" />
        </Field>
      ) : null}

      {!state?.ok && state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success-foreground">{t("admin.news.created")}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("admin.news.creating") : t("admin.news.create")}
      </Button>
    </form>
  );
}
