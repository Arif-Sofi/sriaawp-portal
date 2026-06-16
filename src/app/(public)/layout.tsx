import { AppShell } from "@/components/shared/app-shell";
import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";
import { getLocale } from "@/lib/i18n/server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <AppShell nav={<SiteHeader locale={locale} />} footer={<SiteFooter locale={locale} />}>
      {children}
    </AppShell>
  );
}
