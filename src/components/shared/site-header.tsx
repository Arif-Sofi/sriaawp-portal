import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalSearch } from "@/components/portal/portal-search";
import { translate, type Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

import { LanguageToggle } from "./language-toggle";

type SiteHeaderProps = {
  locale: Locale;
};

export function SiteHeader({ locale }: SiteHeaderProps) {
  const t = (key: string) => translate(ui, key, locale);

  const brand = (
    <Link href="/" className="text-sm font-bold text-primary-foreground hover:opacity-90">
      SRIAAWP
    </Link>
  );

  const right = (
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
