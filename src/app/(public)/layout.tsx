import { AppShell } from "@/components/shared/app-shell";
import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";
import { getCurrentUser } from "@/lib/rbac";
import { getLocale } from "@/lib/i18n/server";
import { dashboardPathForRoles } from "@/lib/navigation";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [sessionUser, locale] = await Promise.all([getCurrentUser(), getLocale()]);

  const dash = sessionUser ? dashboardPathForRoles(sessionUser.roles) : null;
  const headerUser = sessionUser
    ? {
        name: sessionUser.name ?? sessionUser.email ?? "",
        dashboardHref: dash === "/" ? null : dash,
      }
    : null;

  return (
    <AppShell
      nav={<SiteHeader locale={locale} user={headerUser} />}
      footer={<SiteFooter locale={locale} />}
    >
      {children}
    </AppShell>
  );
}
