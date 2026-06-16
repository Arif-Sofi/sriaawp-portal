import Link from "next/link";

import { translate, type Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";

type SiteFooterProps = {
  locale: Locale;
};

export function SiteFooter({ locale }: SiteFooterProps) {
  const t = (key: string) => translate(ui, key, locale);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted">
      <div className="container flex flex-col items-center justify-between gap-2 py-4 text-xs text-muted-foreground sm:flex-row">
        <p>
          &copy; {year} SRIAAWP. {t("footer.rights")}
        </p>
        <Link href="/privacy" className="hover:text-foreground transition-colors">
          {t("footer.privacy")}
        </Link>
      </div>
    </footer>
  );
}
