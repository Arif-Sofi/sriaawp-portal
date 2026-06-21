import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { facebookSyncEnabled } from "@/lib/facebook/settings";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/rbac";
import { FacebookSyncToggle } from "./_components/facebook-sync-toggle";

export default async function AdminSettingsPage() {
  await requirePermission("admin:settings:manage");
  const [locale, syncEnabled] = await Promise.all([getLocale(), facebookSyncEnabled()]);

  const t = (key: string) => translate(ui, key, locale);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("admin.settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.settings.desc")}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {t("admin.fb.settingsTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.fb.settingsDesc")}</p>
        </CardHeader>
        <CardContent>
          <FacebookSyncToggle enabled={syncEnabled} locale={locale} />
        </CardContent>
      </Card>
    </main>
  );
}
