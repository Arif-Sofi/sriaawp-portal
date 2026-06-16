import { cache } from "react";

import { desc, eq } from "drizzle-orm";

import {
  parentVerificationRequest,
  permissions as permissionsTable,
  rolePermission,
  roles as rolesTable,
  staffProfile,
  userRole,
} from "@/db/schema";
import { db } from "@/lib/db";
import type { PermissionCode, RoleCode, UserStatus } from "@/lib/rbac/types";

export interface SessionContext {
  roles: RoleCode[];
  permissions: PermissionCode[];
  deptIds: string[];
  status: UserStatus;
}

async function loadRolesAndPermissions(userId: string) {
  return db
    .select({
      roleCode: rolesTable.code,
      permissionCode: permissionsTable.code,
      scopeType: userRole.scopeType,
      scopeId: userRole.scopeId,
    })
    .from(userRole)
    .innerJoin(rolesTable, eq(rolesTable.id, userRole.roleId))
    .leftJoin(rolePermission, eq(rolePermission.roleId, rolesTable.id))
    .leftJoin(permissionsTable, eq(permissionsTable.id, rolePermission.permissionId))
    .where(eq(userRole.userId, userId));
}

async function loadStaffDeptIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ deptId: staffProfile.deptId })
    .from(staffProfile)
    .where(eq(staffProfile.userId, userId));
  return rows.map((row) => row.deptId).filter((id): id is string => id !== null);
}

async function loadParentStatus(userId: string): Promise<UserStatus> {
  const [latest] = await db
    .select({ status: parentVerificationRequest.status })
    .from(parentVerificationRequest)
    .where(eq(parentVerificationRequest.userId, userId))
    .orderBy(desc(parentVerificationRequest.createdAt))
    .limit(1);
  if (!latest) return "ACTIVE";
  if (latest.status === "approved") return "ACTIVE";
  if (latest.status === "rejected") return "SUSPENDED";
  return "PENDING_VERIFICATION";
}

async function resolveStatus(userId: string, roleCodes: RoleCode[]): Promise<UserStatus> {
  if (!roleCodes.includes("parent")) return "ACTIVE";
  return loadParentStatus(userId);
}

export const loadSessionContext = cache(async (userId: string): Promise<SessionContext> => {
  const rows = await loadRolesAndPermissions(userId);
  const roleSet = new Set<string>();
  const permissionSet = new Set<string>();
  const deptSet = new Set<string>();

  for (const row of rows) {
    roleSet.add(row.roleCode);
    if (row.permissionCode) permissionSet.add(row.permissionCode);
    if (row.scopeType === "department") deptSet.add(row.scopeId);
  }

  const staffDeptIds = await loadStaffDeptIds(userId);
  for (const id of staffDeptIds) deptSet.add(id);

  const roleCodes = Array.from(roleSet) as RoleCode[];
  const status = await resolveStatus(userId, roleCodes);

  return {
    roles: roleCodes,
    permissions: Array.from(permissionSet) as PermissionCode[],
    deptIds: Array.from(deptSet),
    status,
  };
});
