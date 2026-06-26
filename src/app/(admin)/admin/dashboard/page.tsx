import { Icon } from "@/components/ui/icon";
import { AppShortcuts } from "@/components/portal/app-shortcuts";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { ADMIN_NAV, filterNavDefs } from "@/lib/navigation";
import { requirePermission } from "@/lib/rbac";

export default async function AdminDashboardPage() {
  const user = await requirePermission("admin:dashboard:read");
  const locale = await getLocale();
  const t = (key: string) => translate(ui, key, locale);

  const items = filterNavDefs(ADMIN_NAV, user).map((d) => ({
    href: d.href,
    label: t(d.labelKey),
    icon: <Icon name={d.icon} />,
  }));

  return (
    <>
      <AppShortcuts items={items} />

      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-foreground">Papan Pemuka Pentadbir</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin dashboard</p>
        <p className="mt-6 text-sm text-foreground">Selamat datang, {user.name ?? user.email}.</p>
      </main>
    </>
  );
}
