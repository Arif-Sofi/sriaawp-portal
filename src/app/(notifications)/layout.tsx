import { AppShell } from "@/components/shared/app-shell";
import { AuthHeader } from "@/components/shared/auth-header";
import { auth } from "@/lib/auth";
import { dashboardPathForRoles } from "@/lib/navigation";
import { getLocale } from "@/lib/i18n/server";

export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const name = session?.user?.name ?? session?.user?.email ?? "";
  const homeHref = session?.user ? dashboardPathForRoles(session.user.roles) : "/";

  const nav = (
    <AuthHeader locale={locale} userName={name} homeHref={homeHref} userId={session?.user?.id} />
  );

  return <AppShell nav={nav}>{children}</AppShell>;
}
