"use client";

import { useState } from "react";

import { uploadDocument } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import type { ActionResult } from "@/lib/utils/result";

type DeptOption = { id: string; name: string };

type UploadFormProps = {
  locale: Locale;
  departments: DeptOption[];
};

type FormState = ActionResult<unknown> | null;

export function UploadForm({ locale, departments }: UploadFormProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [state, setState] = useState<FormState>(null);
  const [pending, setPending] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "internal" | "role_list">("internal");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const result = await uploadDocument(formData);
    setState(result);
    setPending(false);
    if (result.ok) form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label={t("documents.fieldTitle")}
        htmlFor="doc-title"
        error={!state?.ok ? state?.fieldErrors?.title : undefined}
      >
        <Input
          id="doc-title"
          name="title"
          placeholder={t("documents.fieldTitlePlaceholder")}
          required
        />
      </Field>

      <Field label={t("documents.fieldDescription")} htmlFor="doc-description">
        <Textarea
          id="doc-description"
          name="description"
          placeholder={t("documents.fieldDescriptionPlaceholder")}
        />
      </Field>

      <Field
        label={t("documents.fieldFile")}
        htmlFor="doc-file"
        error={!state?.ok ? state?.fieldErrors?.file : undefined}
      >
        <Input id="doc-file" name="file" type="file" accept=".pdf,.docx,.xlsx,.txt,.md" required />
      </Field>

      <Field label={t("documents.fieldVisibility")} htmlFor="doc-visibility">
        <Select
          id="doc-visibility"
          name="visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as "public" | "internal" | "role_list")}
        >
          <option value="public">{t("documents.visibilityPublic")}</option>
          <option value="internal">{t("documents.visibilityInternal")}</option>
          <option value="role_list">{t("documents.visibilityRoleList")}</option>
        </Select>
      </Field>

      {visibility === "role_list" ? (
        <Field label={t("documents.fieldVisibilityRoles")} htmlFor="doc-visibility-roles">
          <Input id="doc-visibility-roles" name="visibilityRoles" placeholder="teacher, admin" />
        </Field>
      ) : null}

      <Field label={t("documents.fieldDept")} htmlFor="doc-dept">
        <Select id="doc-dept" name="deptId">
          <option value="">{t("documents.noDept")}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>

      {!state?.ok && state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success-foreground">{t("documents.uploadSuccess")}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("documents.uploading") : t("documents.upload")}
      </Button>
    </form>
  );
}
