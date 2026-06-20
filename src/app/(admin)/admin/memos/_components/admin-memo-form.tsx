"use client";

import { useState } from "react";

import { createMemo } from "@/app/actions/memos";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import type { ActionResult } from "@/lib/utils/result";

type MemoVisibility = "internal" | "role_list";

type FormState = ActionResult<unknown> | null;

type AdminMemoFormProps = {
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

export function AdminMemoForm({ locale }: AdminMemoFormProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [state, setState] = useState<FormState>(null);
  const [pending, setPending] = useState(false);
  const [visibility, setVisibility] = useState<MemoVisibility>("internal");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const result = await createMemo({
      title: String(data.get("title") ?? ""),
      body: String(data.get("body") ?? ""),
      visibility,
      visibilityRoles:
        visibility === "role_list"
          ? parseRoles(String(data.get("visibilityRoles") ?? ""))
          : undefined,
      pinned: data.get("pinned") === "on",
    });

    setState(result);
    setPending(false);
    if (!result.ok) return;
    form.reset();
    setVisibility("internal");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label={t("admin.memo.fieldTitle")}
        htmlFor="memo-title"
        error={!state?.ok ? state?.fieldErrors?.title : undefined}
      >
        <Input
          id="memo-title"
          name="title"
          placeholder={t("admin.memo.fieldTitlePlaceholder")}
          required
        />
      </Field>

      <Field
        label={t("admin.memo.fieldBody")}
        htmlFor="memo-body"
        error={!state?.ok ? state?.fieldErrors?.body : undefined}
      >
        <Textarea
          id="memo-body"
          name="body"
          rows={6}
          placeholder={t("admin.memo.fieldBodyPlaceholder")}
          required
        />
      </Field>

      <Field label={t("admin.content.fieldVisibility")} htmlFor="memo-visibility">
        <Select
          id="memo-visibility"
          name="visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as MemoVisibility)}
        >
          <option value="internal">{t("admin.content.visibilityInternal")}</option>
          <option value="role_list">{t("admin.content.visibilityRoleList")}</option>
        </Select>
      </Field>

      {visibility === "role_list" ? (
        <Field label={t("admin.content.fieldVisibilityRoles")} htmlFor="memo-visibility-roles">
          <Input id="memo-visibility-roles" name="visibilityRoles" placeholder="teacher, admin" />
        </Field>
      ) : null}

      <label htmlFor="memo-pinned" className="flex items-center gap-2 text-sm text-foreground">
        <input id="memo-pinned" name="pinned" type="checkbox" className="h-4 w-4" />
        {t("admin.content.fieldPinned")}
      </label>

      {!state?.ok && state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success-foreground">{t("admin.memo.created")}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("admin.memo.creating") : t("admin.memo.create")}
      </Button>
    </form>
  );
}
