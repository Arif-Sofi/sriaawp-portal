import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listUsersWithRoles } from "@/lib/admin/queries";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { requirePermission } from "@/lib/rbac";

export default async function AdminUsersPage() {
  await requirePermission("user:manage_roles");

  const [users, locale] = await Promise.all([listUsersWithRoles(), getLocale()]);

  const t = (key: string) => translate(ui, key, locale);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("admin.users.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.users.desc")}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">{t("admin.users.title")}</h2>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.users.noUsers")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-medium text-muted-foreground">
                      {t("admin.users.colName")}
                    </th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">
                      {t("admin.users.colEmail")}
                    </th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">
                      {t("admin.users.colRoles")}
                    </th>
                    <th className="py-2 font-medium text-muted-foreground">
                      {t("admin.users.manageRoles")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="py-3 pr-4 font-medium text-foreground">{user.name ?? "—"}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{user.email ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roleCodes.length === 0 ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            user.roleCodes.map((code) => (
                              <Badge key={code} variant="info">
                                {code}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-primary text-sm hover:underline"
                        >
                          {t("admin.users.manageRoles")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
