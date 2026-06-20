import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listAllMemos } from "@/lib/content/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/rbac";
import { AdminMemoForm } from "./_components/admin-memo-form";
import { MemoRowActions } from "./_components/memo-row-actions";

export default async function AdminMemosPage() {
  await requirePermission("memo:author");
  const [items, locale] = await Promise.all([listAllMemos(), getLocale()]);

  const t = (key: string) => translate(ui, key, locale);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("admin.memo.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.memo.desc")}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {t("admin.memo.createTitle")}
          </h2>
        </CardHeader>
        <CardContent>
          <AdminMemoForm locale={locale} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {t("admin.memo.allTitle")}
          </h2>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.memo.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.visibility}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {item.pinned ? <Badge variant="info">{t("admin.content.pinned")}</Badge> : null}
                    <Badge variant={item.publishedAt ? "success" : "warning"}>
                      {item.publishedAt ? t("admin.content.published") : t("admin.content.draft")}
                    </Badge>
                    <MemoRowActions row={item} locale={locale} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
