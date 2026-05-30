import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getUserDetail, listDepartments, listRolesCatalogue } from "@/lib/admin/queries";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { requirePermission } from "@/lib/rbac";
import { RoleManager } from "./_components/role-manager";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserDetailPage({ params }: Props) {
  await requirePermission("user:manage_roles");

  const { userId } = await params;
  const [user, roles, departments, locale] = await Promise.all([
    getUserDetail(userId),
    listRolesCatalogue(),
    listDepartments(),
    getLocale(),
  ]);

  if (!user) notFound();

  const t = (key: string) => translate(ui, key, locale);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("admin.userDetail.title")}</h1>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {user.name ?? user.email ?? user.id}
          </h2>
          {user.email ? <p className="text-sm text-muted-foreground">{user.email}</p> : null}
        </CardHeader>
        <CardContent>
          <RoleManager
            userId={user.id}
            currentScopes={user.roleScopes}
            roles={roles}
            departments={departments}
            locale={locale}
          />
        </CardContent>
      </Card>
    </main>
  );
}
