import Link from "next/link";
import { forbidden } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { AppShortcuts } from "@/components/portal/app-shortcuts";
import { PortalSection } from "@/components/portal/portal-section";
import { listVisibleNews } from "@/lib/content/queries";
import { listVisibleOccurrences } from "@/lib/calendar/queries";
import { listChildrenForParent } from "@/lib/family/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { hasPermission, requireUser } from "@/lib/rbac";

import { PendingApprovalNotice } from "./pending-approval-notice";

function monthRangeISO(date: Date): { fromISO: string; toISO: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const fromISO = new Date(year, month, 1).toISOString();
  const toISO = new Date(year, month + 1, 1).toISOString();
  return { fromISO, toISO };
}

export default async function ParentDashboardPage() {
  const user = await requireUser();
  if (user.status === "PENDING_VERIFICATION") return <PendingApprovalNotice />;
  if (!hasPermission(user, "user:read:self")) forbidden();

  const locale = await getLocale();
  const t = (key: string) => translate(ui, key, locale);

  const now = new Date();
  const { fromISO, toISO } = monthRangeISO(now);

  const [children, allNews, occurrences] = await Promise.all([
    listChildrenForParent(user.id),
    listVisibleNews(user),
    listVisibleOccurrences({ fromISO, toISO, user }),
  ]);

  const topNews = allNews.slice(0, 3);
  const upcomingOccurrences = occurrences.slice(0, 5);

  const shortcuts = [
    { href: "/parent/children", label: t("parent.shortcutChildren"), icon: <Icon name="users" /> },
    { href: "/takwim", label: t("parent.shortcutTakwim"), icon: <Icon name="calendar" /> },
    { href: "/news", label: t("parent.shortcutNews"), icon: <Icon name="news" /> },
  ];

  return (
    <>
      <AppShortcuts items={shortcuts} />

      <div className="space-y-6 py-6">
        <PortalSection
          title={t("parent.myChildren")}
          action={
            children.length > 0 ? (
              <Link href="/parent/children" className="hover:underline">
                {t("parent.viewAll")}
              </Link>
            ) : undefined
          }
        >
          {children.length === 0 ? (
            <EmptyState
              title={t("parent.emptyChildren")}
              description={t("parent.emptyChildrenDesc")}
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <ul className="divide-y divide-border">
              {children.map((child) => (
                <li key={child.studentUserId} className="py-3">
                  <Link
                    href={`/parent/children/${child.studentUserId}`}
                    className="flex items-center justify-between gap-4 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {child.name ?? child.studentNo}
                      </p>
                      {child.classLabel ? (
                        <p className="text-xs text-muted-foreground">
                          {t("parent.childClass")}: {child.classLabel}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="neutral">{child.relationship}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PortalSection>

        <PortalSection
          title={t("parent.news")}
          action={
            <Link href="/news" className="hover:underline">
              {t("section.seeAll")}
            </Link>
          }
        >
          {topNews.length === 0 ? (
            <EmptyState
              title={t("empty.noNews")}
              description={t("empty.noNewsDesc")}
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <ul className="divide-y divide-border">
              {topNews.map((item) => (
                <li key={item.id} className="py-3">
                  <Link
                    href={`/news/${item.slug}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    {item.title}
                  </Link>
                  {item.publishedAt ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(item.publishedAt).toLocaleDateString(
                        locale === "ms" ? "ms-MY" : "en-GB",
                      )}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </PortalSection>

        <PortalSection
          title={t("parent.takwim")}
          action={
            <Link href="/takwim" className="hover:underline">
              {t("section.seeAll")}
            </Link>
          }
        >
          {upcomingOccurrences.length === 0 ? (
            <EmptyState
              title={t("takwim.empty")}
              description={t("takwim.emptyDesc")}
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <ul className="divide-y divide-border">
              {upcomingOccurrences.map((o) => (
                <li key={o.occurrenceId} className="flex flex-col gap-1 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{o.title}</span>
                    {o.priority === "exam" ? (
                      <Badge variant="destructive">{t("takwim.exam")}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {o.startAt.toLocaleDateString(locale === "ms" ? "ms-MY" : "en-GB")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </PortalSection>
      </div>
    </>
  );
}
