"use client";

import { useState } from "react";

import { deleteNews, publishNews, updateNews } from "@/app/actions/news";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { news } from "@/db/schema";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

type NewsRow = typeof news.$inferSelect;
type NewsVisibility = "public" | "internal" | "role_list";

type NewsRowActionsProps = {
  row: NewsRow;
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

export function NewsRowActions({ row, locale }: NewsRowActionsProps) {
  const t = (key: string) => translate(ui, key, locale);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<NewsVisibility>(row.visibility);

  async function handlePublish() {
    setPending(true);
    setPublishError(null);
    const result = await publishNews(row.id);
    setPending(false);
    if (!result.ok) setPublishError(result.error);
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const data = new FormData(e.currentTarget);
    const result = await updateNews(row.id, {
      title: String(data.get("title") ?? ""),
      excerpt: String(data.get("excerpt") ?? ""),
      body: String(data.get("body") ?? ""),
      visibility,
      visibilityRoles:
        visibility === "role_list"
          ? parseRoles(String(data.get("visibilityRoles") ?? ""))
          : undefined,
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
    const result = await deleteNews(row.id);
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
    setVisibility(row.visibility);
    setEditOpen(true);
  }

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-2">
        {row.publishedAt === null ? (
          <Button variant="outline" size="sm" onClick={handlePublish} disabled={pending}>
            {pending ? t("admin.content.publishing") : t("admin.content.publish")}
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={openEdit}>
          {t("admin.content.edit")}
        </Button>
        <Button variant="destructive" size="sm" onClick={openDelete}>
          {t("admin.content.delete")}
        </Button>
      </div>
      {publishError ? <p className="mt-1 text-xs text-destructive">{publishError}</p> : null}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={t("admin.news.editTitle")}>
        <form onSubmit={handleEdit} className="space-y-4">
          <Field label={t("admin.news.fieldTitle")} htmlFor="news-edit-title">
            <Input id="news-edit-title" name="title" defaultValue={row.title} required />
          </Field>

          <Field label={t("admin.news.fieldExcerpt")} htmlFor="news-edit-excerpt">
            <Input id="news-edit-excerpt" name="excerpt" defaultValue={row.excerpt ?? ""} />
          </Field>

          <Field label={t("admin.news.fieldBody")} htmlFor="news-edit-body">
            <Textarea id="news-edit-body" name="body" rows={6} defaultValue={row.body} required />
          </Field>

          <Field label={t("admin.content.fieldVisibility")} htmlFor="news-edit-visibility">
            <Select
              id="news-edit-visibility"
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
            <Field
              label={t("admin.content.fieldVisibilityRoles")}
              htmlFor="news-edit-visibility-roles"
            >
              <Input
                id="news-edit-visibility-roles"
                name="visibilityRoles"
                defaultValue={row.visibilityRoles?.join(", ") ?? ""}
                placeholder="teacher, admin"
              />
            </Field>
          ) : null}

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
