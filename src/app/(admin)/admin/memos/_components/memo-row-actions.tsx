"use client";

import { useState } from "react";

import { deleteMemo, updateMemo } from "@/app/actions/memos";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { memo } from "@/db/schema";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

type MemoRow = typeof memo.$inferSelect;
type MemoVisibility = "internal" | "role_list";

type MemoRowActionsProps = {
  row: MemoRow;
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

export function MemoRowActions({ row, locale }: MemoRowActionsProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<MemoVisibility>(
    row.visibility === "public" ? "internal" : row.visibility,
  );

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const data = new FormData(e.currentTarget);
    const result = await updateMemo(row.id, {
      title: String(data.get("title") ?? ""),
      body: String(data.get("body") ?? ""),
      visibility,
      visibilityRoles:
        visibility === "role_list"
          ? parseRoles(String(data.get("visibilityRoles") ?? ""))
          : undefined,
      pinned: data.get("pinned") === "on",
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditOpen(false);
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteMemo(row.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDeleteOpen(false);
  }

  function openDelete() {
    setError(null);
    setDeleteOpen(true);
  }

  function openEdit() {
    setError(null);
    setVisibility(row.visibility === "public" ? "internal" : row.visibility);
    setEditOpen(true);
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button variant="outline" size="sm" onClick={openEdit}>
        {t("admin.content.edit")}
      </Button>
      <Button variant="destructive" size="sm" onClick={openDelete}>
        {t("admin.content.delete")}
      </Button>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={t("admin.memo.editTitle")}>
        <form onSubmit={handleEdit} className="space-y-4">
          <Field label={t("admin.memo.fieldTitle")} htmlFor="memo-edit-title">
            <Input id="memo-edit-title" name="title" defaultValue={row.title} required />
          </Field>

          <Field label={t("admin.memo.fieldBody")} htmlFor="memo-edit-body">
            <Textarea id="memo-edit-body" name="body" rows={6} defaultValue={row.body} required />
          </Field>

          <Field label={t("admin.content.fieldVisibility")} htmlFor="memo-edit-visibility">
            <Select
              id="memo-edit-visibility"
              name="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as MemoVisibility)}
            >
              <option value="internal">{t("admin.content.visibilityInternal")}</option>
              <option value="role_list">{t("admin.content.visibilityRoleList")}</option>
            </Select>
          </Field>

          {visibility === "role_list" ? (
            <Field
              label={t("admin.content.fieldVisibilityRoles")}
              htmlFor="memo-edit-visibility-roles"
            >
              <Input
                id="memo-edit-visibility-roles"
                name="visibilityRoles"
                defaultValue={row.visibilityRoles?.join(", ") ?? ""}
                placeholder="teacher, admin"
              />
            </Field>
          ) : null}

          <label
            htmlFor="memo-edit-pinned"
            className="flex items-center gap-2 text-sm text-foreground"
          >
            <input
              id="memo-edit-pinned"
              name="pinned"
              type="checkbox"
              className="h-4 w-4"
              defaultChecked={row.pinned}
            />
            {t("admin.content.fieldPinned")}
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              {t("admin.content.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("admin.content.saving") : t("admin.content.save")}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("admin.content.confirmDelete")}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("admin.content.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? t("admin.content.deleting") : t("admin.content.delete")}
            </Button>
          </>
        }
      >
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </Dialog>
    </div>
  );
}
