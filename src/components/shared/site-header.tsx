import Link from "next/link";

import { Button, buttonClasses } from "@/components/ui/button";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalSearch } from "@/components/portal/portal-search";
import { signOutAction } from "@/app/actions/auth";
import { translate, type Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

import { LanguageToggle } from "./language-toggle";

type SiteHeaderUser = {
  name: string;
  dashboardHref: string | null;
};

type SiteHeaderProps = {
  locale: Locale;
  user?: SiteHeaderUser | null;
};

export function SiteHeader({ locale, user }: SiteHeaderProps) {
  const t = (key: string) => translate(ui, key, locale);

  const brand = (
    <Link href="/" className="text-sm font-bold text-primary-foreground hover:opacity-90">
      SRIAAWP
    </Link>
  );

  const right = user ? (
    <>
      {user.name ? <span className="text-sm text-primary-foreground/80">{user.name}</span> : null}
      {user.dashboardHref ? (
        <Link
          href={user.dashboardHref}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          {t("nav.dashboard")}
        </Link>
      ) : null}
      <LanguageToggle locale={locale} />
      <form action={signOutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="text-primary-foreground hover:bg-primary-foreground/10"
        >
          {t("nav.logout")}
        </Button>
      </form>
    </>
  ) : (
    <>
      <LanguageToggle locale={locale} />
      <Link href="/login" className={buttonClasses({ variant: "secondary", size: "sm" })}>
        {t("nav.login")}
      </Link>
    </>
  );

  return (
    <PortalHeader
      brand={brand}
      search={<PortalSearch placeholder={t("search.placeholder")} />}
      right={right}
    />
  );
}
