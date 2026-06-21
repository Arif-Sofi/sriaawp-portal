import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalSearch } from "@/components/portal/portal-search";
import { signOutAction } from "@/app/actions/auth";
import { countUnreadNotifications } from "@/lib/engagement/queries";
import { translate, type Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import Link from "next/link";

import { LanguageToggle } from "./language-toggle";

type AuthHeaderProps = {
  locale: Locale;
  userName: string;
  homeHref?: string;
  userId?: string;
};

export async function AuthHeader({ locale, userName, homeHref = "/", userId }: AuthHeaderProps) {
  const t = (key: string) => translate(ui, key, locale);
  const unreadCount = userId ? await countUnreadNotifications(userId) : 0;

  const brand = (
    <Link href={homeHref} className="text-sm font-bold text-primary-foreground hover:opacity-90">
      SRIAAWP
    </Link>
  );

  const right = (
    <>
      {userName ? <span className="text-sm text-primary-foreground/80">{userName}</span> : null}
      <Link
        href="/notifications"
        className="relative inline-flex items-center text-sm text-primary-foreground/80 hover:text-primary-foreground"
      >
        {t("engagement.notifications")}
        {unreadCount > 0 ? (
          <Badge variant="destructive" className="ml-1">
            {unreadCount}
          </Badge>
        ) : null}
      </Link>
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
  );

  return (
    <PortalHeader
      brand={brand}
      search={<PortalSearch placeholder={t("search.placeholder")} />}
      right={right}
    />
  );
}
