"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { linkFamily } from "@/app/actions/admin-users";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/utils/result";

type ParentOption = {
  id: string;
  name: string | null;
  email: string | null;
};

type StudentOption = {
  id: string;
  name: string | null;
  studentNo: string;
};

type LinkFamilyFormProps = {
  parents: ParentOption[];
  students: StudentOption[];
  locale: Locale;
};

type FormState = ActionResult<unknown> | null;

const RELATIONSHIPS = ["father", "mother", "guardian"] as const;

export function LinkFamilyForm({ parents, students, locale }: LinkFamilyFormProps) {
  const [parentId, setParentId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [relationship, setRelationship] = useState("");
  const [primaryContact, setPrimaryContact] = useState(false);
  const [state, setState] = useState<FormState>(null);
  const [pending, setPending] = useState(false);

  const t = (key: string) => translate(ui, key, locale);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!parentId || !studentId || !relationship) return;

    setPending(true);
    setState(null);

    const result = await linkFamily({
      parentUserId: parentId,
      studentUserId: studentId,
      relationship: relationship as "father" | "mother" | "guardian",
      primaryContact,
    });

    setState(result);
    setPending(false);
    if (result.ok) {
      setParentId("");
      setStudentId("");
      setRelationship("");
      setPrimaryContact(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">{t("admin.family.parent")}</label>
        <Select value={parentId} onChange={(e) => setParentId(e.target.value)} required>
          <option value="">{t("admin.family.selectParent")}</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? p.email ?? p.id}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">{t("admin.family.student")}</label>
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
          <option value="">{t("admin.family.selectStudent")}</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.id} ({s.studentNo})
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          {t("admin.family.relationship")}
        </label>
        <Select value={relationship} onChange={(e) => setRelationship(e.target.value)} required>
          <option value="">{t("admin.family.selectRelationship")}</option>
          {RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {t(`admin.family.${r}`)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="primaryContact"
          type="checkbox"
          checked={primaryContact}
          onChange={(e) => setPrimaryContact(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <label htmlFor="primaryContact" className="text-sm font-medium text-foreground">
          {t("admin.family.primaryContact")}
        </label>
      </div>

      {!state?.ok && state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? <p className="text-sm text-success-foreground">Link created.</p> : null}

      <Button type="submit" disabled={pending || !parentId || !studentId || !relationship}>
        {t("admin.family.link")}
      </Button>
    </form>
  );
}
