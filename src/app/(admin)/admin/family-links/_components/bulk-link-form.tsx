"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { bulkLinkFamilyCsv } from "@/app/actions/admin-users";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n";

type BulkSummary = {
  created: number;
  skipped: number;
  errors: string[];
};

type BulkLinkFormProps = {
  locale: Locale;
};

export function BulkLinkForm({ locale }: BulkLinkFormProps) {
  const [csvText, setCsvText] = useState("");
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const t = (key: string) => translate(ui, key, locale);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!csvText.trim()) return;

    setPending(true);
    setSummary(null);
    setError(null);

    const result = await bulkLinkFamilyCsv(csvText);

    setPending(false);
    if (result.ok) {
      setSummary(result.data);
      setCsvText("");
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">CSV</label>
        <p className="text-xs text-muted-foreground">{t("admin.family.bulkDesc")}</p>
        <Textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={8}
          placeholder={"parent_email,student_no,relationship\nparent@example.com,S001,father"}
          required
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {summary ? (
        <div className="rounded-md border border-border p-4 space-y-2 text-sm">
          <p>
            <span className="font-medium">{t("admin.family.bulkCreated")}:</span> {summary.created}
          </p>
          <p>
            <span className="font-medium">{t("admin.family.bulkSkipped")}:</span> {summary.skipped}
          </p>
          {summary.errors.length > 0 ? (
            <div>
              <p className="font-medium text-destructive">{t("admin.family.bulkErrors")}:</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-destructive">
                {summary.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={pending || !csvText.trim()}>
        {t("admin.family.bulkImport")}
      </Button>
    </form>
  );
}
