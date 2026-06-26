import { Icon } from "@/components/ui/icon";
import { translate, type Locale } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { ADMIN_NAV, PARENT_NAV, STAFF_NAV, filterNavDefs, type NavItemDef } from "@/lib/navigation";
import type { AuthedUser } from "@/lib/rbac";

import { PortalNav } from "./portal-nav";

type RoleArea = "admin" | "staff" | "parent";

const NAV_BY_AREA: Record<RoleArea, NavItemDef[]> = {
  admin: ADMIN_NAV,
  staff: STAFF_NAV,
  parent: PARENT_NAV,
};

type RoleNavProps = {
  area: RoleArea;
  user: AuthedUser;
  locale: Locale;
};

export function RoleNav({ area, user, locale }: RoleNavProps) {
  const items = filterNavDefs(NAV_BY_AREA[area], user).map((d) => ({
    href: d.href,
    label: translate(ui, d.labelKey, locale),
    icon: <Icon name={d.icon} />,
  }));

  return <PortalNav items={items} />;
}
