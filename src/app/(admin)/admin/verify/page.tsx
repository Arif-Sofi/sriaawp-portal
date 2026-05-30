import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listPendingParentRequests } from "@/lib/admin/queries";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { requirePermission } from "@/lib/rbac";
import { VerifyRequests } from "./_components/verify-requests";

export default async function AdminVerifyPage() {
  await requirePermission("user:verify_parent");

  const [requests, locale] = await Promise.all([listPendingParentRequests(), getLocale()]);

  const t = (key: string) => translate(ui, key, locale);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("admin.verify.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.verify.desc")}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {t("admin.verify.title")}
          </h2>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <EmptyState title={t("admin.verify.empty")} description={t("admin.verify.emptyDesc")} />
          ) : (
            <VerifyRequests requests={requests} locale={locale} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
