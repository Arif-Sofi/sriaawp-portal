import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PortalSection } from "@/components/portal/portal-section";
import { listPublishedPublicNews, listVisibleNews } from "@/lib/content/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { auth } from "@/lib/auth";

const VISIBILITY_LABEL: Record<string, string> = {
  public: "Public",
  internal: "Internal",
  role_list: "Role-restricted",
};

export default async function NewsPage() {
  const locale = await getLocale();
  const t = (key: string) => translate(ui, key, locale);
  const session = await auth();

  const items = session?.user
    ? await listVisibleNews(session.user)
    : await listPublishedPublicNews();

  return (
    <div className="py-6">
      <PortalSection title={t("section.news")}>
        {items.length === 0 ? (
          <EmptyState title={t("empty.noNews")} description={t("empty.noNewsDesc")} />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/news/${item.slug}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.excerpt ? (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {item.excerpt}
                      </p>
                    ) : null}
                    {item.publishedAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(item.publishedAt).toLocaleDateString(
                          locale === "ms" ? "ms-MY" : "en-GB",
                        )}
                      </p>
                    ) : null}
                  </div>
                  {session?.user ? (
                    <Badge variant="neutral" className="shrink-0">
                      {VISIBILITY_LABEL[item.visibility] ?? item.visibility}
                    </Badge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PortalSection>
    </div>
  );
}
