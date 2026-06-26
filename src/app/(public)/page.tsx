import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { AppShortcuts } from "@/components/portal/app-shortcuts";
import { AppTile } from "@/components/portal/app-tile";
import { PortalSection } from "@/components/portal/portal-section";
import { PromoBanner } from "@/components/portal/promo-banner";
import { auth } from "@/lib/auth";
import { listPublicOccurrences } from "@/lib/calendar/queries";
import { listPublishedPublicNews } from "@/lib/content/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { dashboardPathForRoles } from "@/lib/navigation";

export default async function PublicLandingPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(ui, key, locale);

  const now = new Date();
  const fromISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const toISO = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const [allNews, occurrences] = await Promise.all([
    listPublishedPublicNews(),
    listPublicOccurrences({ fromISO, toISO }),
  ]);
  const topNews = allNews.slice(0, 3);
  const upcoming = occurrences.slice(0, 4);

  const dashPath = session?.user ? dashboardPathForRoles(session.user.roles) : null;
  const dash = dashPath && dashPath !== "/" ? dashPath : null;

  const lastShortcut = dash
    ? { href: dash, label: t("nav.dashboard"), icon: <Icon name="home" /> }
    : { href: "/login", label: t("shortcut.logMasuk"), icon: <Icon name="users" /> };

  const shortcuts = [
    { href: "/takwim", label: t("shortcut.takwim"), icon: <Icon name="calendar" /> },
    { href: "/news", label: t("shortcut.berita"), icon: <Icon name="news" /> },
    { href: "/privacy", label: t("shortcut.privasi"), icon: <Icon name="file" /> },
    lastShortcut,
  ];

  const quickLinks = [
    { href: "/news", label: t("shortcut.berita"), icon: <Icon name="news" /> },
    { href: "/takwim", label: t("shortcut.takwim"), icon: <Icon name="calendar" /> },
    { href: "/privacy", label: t("shortcut.privasi"), icon: <Icon name="file" /> },
  ];

  return (
    <>
      <AppShortcuts items={shortcuts} />

      <div className="py-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <PortalSection title={t("section.welcome")}>
            <p className="text-sm text-muted-foreground">{t("welcome.body")}</p>
            <div className="mt-4">
              <Link
                href={dash ?? "/login"}
                className="text-sm font-medium text-primary hover:underline"
              >
                {dash ? t("home.goToDashboard") : t("home.heroCta")}
              </Link>
            </div>
          </PortalSection>

          <PortalSection
            title={t("section.news")}
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
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.publishedAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(item.publishedAt).toLocaleDateString(
                          locale === "ms" ? "ms-MY" : "en-GB",
                          { timeZone: "Asia/Kuala_Lumpur" },
                        )}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </PortalSection>

          <PortalSection
            title={t("section.takwim")}
            action={
              <Link href="/takwim" className="hover:underline">
                {t("section.seeAll")}
              </Link>
            }
          >
            {upcoming.length === 0 ? (
              <EmptyState
                title={t("empty.noTakwim")}
                description={t("empty.noTakwimDesc")}
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((o) => (
                  <li key={o.occurrenceId} className="flex flex-col gap-1 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{o.title}</span>
                      {o.priority === "exam" ? (
                        <Badge variant="destructive">{t("takwim.exam")}</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {o.startAt.toLocaleDateString(locale === "ms" ? "ms-MY" : "en-GB", {
                        timeZone: "Asia/Kuala_Lumpur",
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </PortalSection>

          <PortalSection title={t("section.quickLinks")}>
            <div className="flex flex-wrap gap-1">
              {quickLinks.map((item) => (
                <AppTile key={item.href} href={item.href} label={item.label} icon={item.icon} />
              ))}
            </div>
          </PortalSection>

          <div className="md:col-span-2">
            <PromoBanner
              tone="primary"
              title={t("promo.title")}
              body={t("promo.body")}
              action={
                <Link
                  href={dash ?? "/login"}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary-foreground px-4 text-sm font-medium text-primary transition-colors hover:bg-primary-foreground/90"
                >
                  {dash ? t("nav.dashboard") : t("nav.login")}
                </Link>
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
