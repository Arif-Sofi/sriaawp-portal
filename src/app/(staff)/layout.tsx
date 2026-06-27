import { AppShell } from "@/components/shared/app-shell";
import { AuthHeader } from "@/components/shared/auth-header";
import { RoleNav } from "@/components/portal/role-nav";
import { getCurrentUser } from "@/lib/rbac";
import { getLocale } from "@/lib/i18n/server";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const name = user?.name ?? user?.email ?? "";

  const nav = (
    <>
      <AuthHeader
        locale={locale}
        userName={name}
        homeHref="/staff/dashboard"
        userId={session?.user?.id}
      />
      {session?.user ? <RoleNav area="staff" user={session.user} locale={locale} /> : null}
    </>
  );

  return <AppShell nav={nav}>{children}</AppShell>;
}
