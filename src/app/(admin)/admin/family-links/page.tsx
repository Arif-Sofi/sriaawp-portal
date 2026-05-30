import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listParentsBrief, listStudentsBrief } from "@/lib/admin/queries";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { requirePermission } from "@/lib/rbac";
import { BulkLinkForm } from "./_components/bulk-link-form";
import { LinkFamilyForm } from "./_components/link-family-form";

export default async function AdminFamilyLinksPage() {
  await requirePermission("user:link_family");

  const [parents, students, locale] = await Promise.all([
    listParentsBrief(),
    listStudentsBrief(),
    getLocale(),
  ]);

  const t = (key: string) => translate(ui, key, locale);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("admin.family.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.family.desc")}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {t("admin.family.manualTitle")}
          </h2>
        </CardHeader>
        <CardContent>
          <LinkFamilyForm parents={parents} students={students} locale={locale} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {t("admin.family.bulkTitle")}
          </h2>
        </CardHeader>
        <CardContent>
          <BulkLinkForm locale={locale} />
        </CardContent>
      </Card>
    </main>
  );
}
