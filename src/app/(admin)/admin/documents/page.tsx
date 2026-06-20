import { ReplaceVersionButton } from "@/components/shared/replace-version-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileTable } from "@/components/ui/file-table";
import { listDepartments } from "@/lib/admin/queries";
import { listAllDocuments } from "@/lib/documents/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { DeleteButton } from "./_components/delete-button";
import { UploadForm } from "./_components/upload-form";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminDocumentsPage() {
  const [user, locale] = await Promise.all([requirePermission("document:upload"), getLocale()]);
  const [docs, departments] = await Promise.all([listAllDocuments(), listDepartments()]);
  const t = (key: string) => translate(ui, key, locale);
  const canEdit = hasPermission(user, "document:edit");

  const rows = docs.map((doc) => ({
    id: doc.id,
    name: doc.title,
    sizeLabel: formatBytes(doc.sizeBytes),
    version: doc.versionNo != null ? `v${doc.versionNo}` : "—",
    updatedAtLabel: doc.updatedAt.toLocaleDateString(locale === "ms" ? "ms-MY" : "en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
    }),
    href: `/api/documents/${doc.id}/download`,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("documents.adminPageTitle")}</h1>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {t("documents.uploadTitle")}
          </h2>
        </CardHeader>
        <CardContent>
          <UploadForm locale={locale} departments={departments} />
        </CardContent>
      </Card>

      <FileTable
        files={rows}
        emptyLabel={t("documents.empty")}
        actions={(file) => (
          <div className="flex items-center gap-2">
            {canEdit ? <ReplaceVersionButton documentId={file.id} locale={locale} /> : null}
            <DeleteButton documentId={file.id} locale={locale} />
          </div>
        )}
      />
    </main>
  );
}
