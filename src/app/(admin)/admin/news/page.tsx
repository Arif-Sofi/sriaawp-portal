import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listAllNews } from "@/lib/content/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/rbac";
import { AdminNewsForm } from "./_components/admin-news-form";
import { NewsRowActions } from "./_components/news-row-actions";

export default async function AdminNewsPage() {
  await requirePermission("news:author");
  const [items, locale] = await Promise.all([listAllNews(), getLocale()]);

  const t = (key: string) => translate(ui, key, locale);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("admin.news.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.news.desc")}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {t("admin.news.createTitle")}
          </h2>
        </CardHeader>
        <CardContent>
          <AdminNewsForm locale={locale} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">
            {t("admin.news.allTitle")}
          </h2>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.news.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">/news/{item.slug}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={item.publishedAt ? "success" : "warning"}>
                      {item.publishedAt ? t("admin.content.published") : t("admin.content.draft")}
                    </Badge>
                    <NewsRowActions row={item} locale={locale} />
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
