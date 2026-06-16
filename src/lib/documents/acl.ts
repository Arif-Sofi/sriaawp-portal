import type { AuthedUser } from "@/lib/rbac";

type DocAclInput = {
  visibility: "public" | "internal" | "role_list";
  visibilityRoles?: string[] | null;
  deptId?: string | null;
};

export function computeUserAclKeys(user: Pick<AuthedUser, "roles" | "deptIds">): string[] {
  return [
    "public",
    "internal",
    ...user.roles.map((r) => `role:${r}`),
    ...user.deptIds.map((d) => `dept:${d}`),
  ];
}

export function computeDocAclKeys({ visibility, visibilityRoles, deptId }: DocAclInput): string[] {
  const base = resolveVisibilityKeys(visibility, visibilityRoles);
  if (!deptId) return base;
  return [...base, `dept:${deptId}`];
}

function resolveVisibilityKeys(
  visibility: "public" | "internal" | "role_list",
  visibilityRoles?: string[] | null,
): string[] {
  if (visibility === "public") return ["public"];
  if (visibility === "internal") return ["internal"];

  const roles = visibilityRoles ?? [];
  return roles.length > 0 ? roles.map((r) => `role:${r}`) : ["internal"];
}
