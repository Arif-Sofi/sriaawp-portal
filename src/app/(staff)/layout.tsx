import { AppShell } from "@/components/shared/app-shell";
import { AuthHeader } from "@/components/shared/auth-header";
import { auth } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const name = session?.user?.name ?? session?.user?.email ?? "";

  return <AppShell nav={<AuthHeader locale={locale} userName={name} />}>{children}</AppShell>;
}
