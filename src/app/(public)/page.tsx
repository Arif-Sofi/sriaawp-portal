import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { AppShortcuts } from "@/components/portal/app-shortcuts";
import { AppTile } from "@/components/portal/app-tile";
import { PortalSection } from "@/components/portal/portal-section";
import { PromoBanner } from "@/components/portal/promo-banner";
import { auth } from "@/lib/auth";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { dashboardPathForRoles } from "@/lib/navigation";

export default async function PublicLandingPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const t = (key: string) => translate(ui, key, locale);

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
            <EmptyState
              title={t("empty.noNews")}
              description={t("empty.noNewsDesc")}
              className="border-0 bg-transparent py-6"
            />
          </PortalSection>

          <PortalSection
            title={t("section.takwim")}
            action={
              <Link href="/takwim" className="hover:underline">
                {t("section.seeAll")}
              </Link>
            }
          >
            <EmptyState
              title={t("empty.noTakwim")}
              description={t("empty.noTakwimDesc")}
              className="border-0 bg-transparent py-6"
            />
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
