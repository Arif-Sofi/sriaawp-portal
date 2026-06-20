import type { IconName } from "@/components/ui/icon";
import { hasPermission, type AuthedUser } from "@/lib/rbac";
import type { PermissionCode, RoleCode } from "@/lib/rbac/types";

export type NavItemDef = {
  href: string;
  labelKey: string;
  icon: IconName;
  permission?: PermissionCode;
};

export const ADMIN_NAV: NavItemDef[] = [
  {
    href: "/admin/dashboard",
    labelKey: "nav.dashboard",
    icon: "home",
    permission: "admin:dashboard:read",
  },
  { href: "/admin/users", labelKey: "nav.users", icon: "users", permission: "user:manage_roles" },
  {
    href: "/admin/documents",
    labelKey: "nav.documents",
    icon: "file",
    permission: "document:upload",
  },
  { href: "/admin/news", labelKey: "nav.news", icon: "news", permission: "news:author" },
  { href: "/admin/memos", labelKey: "nav.memos", icon: "megaphone", permission: "memo:author" },
  {
    href: "/admin/departments",
    labelKey: "nav.departments",
    icon: "book",
    permission: "department:manage",
  },
  {
    href: "/admin/family-links",
    labelKey: "nav.familyLinks",
    icon: "link",
    permission: "user:link_family",
  },
  { href: "/admin/verify", labelKey: "nav.verify", icon: "bell", permission: "user:verify_parent" },
];

export const STAFF_NAV: NavItemDef[] = [
  {
    href: "/staff/dashboard",
    labelKey: "nav.dashboard",
    icon: "home",
    permission: "staff:dashboard:read",
  },
  { href: "/staff/events", labelKey: "nav.events", icon: "calendar", permission: "event:create" },
  {
    href: "/staff/documents",
    labelKey: "nav.documents",
    icon: "file",
    permission: "document:upload",
  },
  { href: "/takwim", labelKey: "nav.takwim", icon: "calendar" },
  { href: "/news", labelKey: "nav.news", icon: "news" },
];

export const PARENT_NAV: NavItemDef[] = [
  { href: "/parent/dashboard", labelKey: "nav.dashboard", icon: "home" },
  { href: "/parent/children", labelKey: "nav.children", icon: "users" },
  { href: "/takwim", labelKey: "nav.takwim", icon: "calendar" },
  { href: "/news", labelKey: "nav.news", icon: "news" },
];

export function dashboardPathForRoles(roles: RoleCode[]): string {
  if (roles.includes("admin")) return "/admin/dashboard";
  if (roles.includes("teacher")) return "/staff/dashboard";
  if (roles.includes("parent")) return "/parent/dashboard";
  return "/";
}

export function filterNavDefs(defs: NavItemDef[], user: AuthedUser): NavItemDef[] {
  return defs.filter((d) => !d.permission || hasPermission(user, d.permission));
}
