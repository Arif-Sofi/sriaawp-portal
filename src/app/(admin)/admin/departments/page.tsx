import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listDepartments } from "@/lib/admin/queries";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { requirePermission } from "@/lib/rbac";
import { CreateDepartmentForm } from "./_components/create-department-form";

export default async function AdminDepartmentsPage() {
  await requirePermission("department:manage");

  const [departments, locale] = await Promise.all([listDepartments(), getLocale()]);

  const t = (key: string) => translate(ui, key, locale);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("admin.departments.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.departments.desc")}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {t("admin.departments.createTitle")}
          </h2>
        </CardHeader>
        <CardContent>
          <CreateDepartmentForm locale={locale} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {t("admin.departments.title")}
          </h2>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.departments.noDepts")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {departments.map((dept) => (
                <li key={dept.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{dept.name}</p>
                    <p className="text-xs text-muted-foreground">{dept.code}</p>
                  </div>
                  <Badge variant={dept.active ? "success" : "warning"}>
                    {dept.active ? t("admin.departments.active") : t("admin.departments.inactive")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
