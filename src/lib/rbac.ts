import { forbidden, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadSessionContext } from "@/lib/rbac/session-context";
import type { AuthedUser } from "@/lib/rbac/session-user";
import type { PermissionCode } from "@/lib/rbac/types";

export type { AuthedUser } from "@/lib/rbac/session-user";

export async function getCurrentUser(): Promise<AuthedUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const ctx = await loadSessionContext(user.id);
  return {
    id: user.id,
    email: user.email ?? "",
    name: (user.user_metadata?.name as string | undefined) ?? null,
    roles: ctx.roles,
    permissions: ctx.permissions,
    deptIds: ctx.deptIds,
    status: ctx.status,
  };
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
