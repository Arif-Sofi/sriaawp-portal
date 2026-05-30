import { SiteHeader } from "@/components/shared/site-header";
import { getLocale } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <>
      <SiteHeader locale={locale} />
      {children}
    </>
  );
}
