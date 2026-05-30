"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDepartment } from "@/app/actions/admin-users";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/utils/result";

type CreateDepartmentFormProps = {
  locale: Locale;
};

type FormState = ActionResult<unknown> | null;

export function CreateDepartmentForm({ locale }: CreateDepartmentFormProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<FormState>(null);
  const [pending, setPending] = useState(false);

  const t = (key: string) => translate(ui, key, locale);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState(null);

    const result = await createDepartment({ code, name });

    setState(result);
    setPending(false);
    if (result.ok) {
      setCode("");
      setName("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">{t("admin.departments.code")}</label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("admin.departments.codePlaceholder")}
          required
        />
        {!state?.ok && state?.fieldErrors?.code ? (
          <p className="text-xs text-destructive">{state.fieldErrors.code}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">{t("admin.departments.name")}</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("admin.departments.namePlaceholder")}
          required
        />
        {!state?.ok && state?.fieldErrors?.name ? (
          <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
        ) : null}
      </div>

      {!state?.ok && state?.error && !state?.fieldErrors ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? <p className="text-sm text-success-foreground">Department created.</p> : null}

      <Button type="submit" disabled={pending || !code.trim() || !name.trim()}>
        {t("admin.departments.create")}
      </Button>
    </form>
  );
}
