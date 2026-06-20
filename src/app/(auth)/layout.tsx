import { SiteHeader } from "@/components/shared/site-header";
import { auth } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { dashboardPathForRoles } from "@/lib/navigation";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);

  const sessionUser = session?.user;
  const dash = sessionUser ? dashboardPathForRoles(sessionUser.roles) : null;
  const headerUser = sessionUser
    ? {
        name: sessionUser.name ?? sessionUser.email ?? "",
        dashboardHref: dash === "/" ? null : dash,
      }
    : null;

  return (
    <>
      <SiteHeader locale={locale} user={headerUser} />
      {children}
    </>
  );
}
