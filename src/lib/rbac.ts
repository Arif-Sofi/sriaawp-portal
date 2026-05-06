import { forbidden, redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";
import type { PermissionCode } from "@/lib/rbac/types";

export type AuthedUser = Session["user"];

export async function getCurrentUser(): Promise<AuthedUser | null> {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser(redirectTo = "/login"): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

export function hasPermission(
  user: Pick<AuthedUser, "permissions" | "deptIds">,
  code: PermissionCode,
  scope?: { deptId?: string },
): boolean {
  if (!user.permissions.includes(code)) return false;
  if (scope?.deptId && !user.deptIds.includes(scope.deptId)) return false;
  return true;
}

export async function requirePermission(
  code: PermissionCode,
  scope?: { deptId?: string },
): Promise<AuthedUser> {
  const user = await requireUser();
  if (!hasPermission(user, code, scope)) forbidden();
  return user;
}
