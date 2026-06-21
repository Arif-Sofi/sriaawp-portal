import { AppShell } from "@/components/shared/app-shell";
import { AuthHeader } from "@/components/shared/auth-header";
import { RoleNav } from "@/components/portal/role-nav";
import { auth } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  const name = session?.user?.name ?? session?.user?.email ?? "";

  const nav = (
    <>
      <AuthHeader
        locale={locale}
        userName={name}
        homeHref="/admin/dashboard"
        userId={session?.user?.id}
      />
      {session?.user ? <RoleNav area="admin" user={session.user} locale={locale} /> : null}
    </>
  );

  return <AppShell nav={nav}>{children}</AppShell>;
}
