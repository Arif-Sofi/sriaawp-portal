import { eq } from "drizzle-orm";

import {
  departments,
  parentProfile,
  parentVerificationRequest,
  roles,
  studentProfile,
  userRole,
  users,
} from "@/db/schema";
import { db } from "@/lib/db";

export type UserWithRoles = {
  id: string;
  name: string | null;
  email: string | null;
  roleCodes: string[];
};

export type UserDetail = {
  id: string;
  name: string | null;
  email: string | null;
  roleCodes: string[];
  roleScopes: { roleCode: string; scopeType: string; scopeId: string }[];
  hasParentProfile: boolean;
  hasStudentProfile: boolean;
};

export type PendingParentRequest = {
  id: string;
  userId: string;
  parentName: string | null;
  parentEmail: string | null;
  studentIcProvided: string;
  createdAt: Date;
};

export type DepartmentRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export type RoleRow = {
  id: string;
  code: string;
  label: string;
};

export type ParentBrief = {
  id: string;
  name: string | null;
  email: string | null;
};

export type StudentBrief = {
  id: string;
  name: string | null;
  studentNo: string;
};

export async function listUsersWithRoles(): Promise<UserWithRoles[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      roleCode: roles.code,
    })
    .from(users)
    .leftJoin(userRole, eq(userRole.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRole.roleId))
    .orderBy(users.createdAt);

  const userMap = new Map<string, UserWithRoles>();
  for (const row of rows) {
    const existing = userMap.get(row.id);
    if (existing) {
      if (row.roleCode) existing.roleCodes.push(row.roleCode);
      continue;
    }
    userMap.set(row.id, {
      id: row.id,
      name: row.name,
      email: row.email,
      roleCodes: row.roleCode ? [row.roleCode] : [],
    });
  }

  return Array.from(userMap.values());
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const [userRow] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) return null;

  const scopeRows = await db
    .select({
      roleCode: roles.code,
      scopeType: userRole.scopeType,
      scopeId: userRole.scopeId,
    })
    .from(userRole)
    .innerJoin(roles, eq(roles.id, userRole.roleId))
    .where(eq(userRole.userId, userId));

  const [parentRow] = await db
    .select({ userId: parentProfile.userId })
    .from(parentProfile)
    .where(eq(parentProfile.userId, userId))
    .limit(1);

  const [studentRow] = await db
    .select({ userId: studentProfile.userId })
    .from(studentProfile)
    .where(eq(studentProfile.userId, userId))
    .limit(1);

  return {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    roleCodes: [...new Set(scopeRows.map((r) => r.roleCode))],
    roleScopes: scopeRows.map((r) => ({
      roleCode: r.roleCode,
      scopeType: r.scopeType,
      scopeId: r.scopeId,
    })),
    hasParentProfile: !!parentRow,
    hasStudentProfile: !!studentRow,
  };
}

export async function listPendingParentRequests(): Promise<PendingParentRequest[]> {
  const rows = await db
    .select({
      id: parentVerificationRequest.id,
      userId: parentVerificationRequest.userId,
      parentName: users.name,
      parentEmail: users.email,
      studentIcProvided: parentVerificationRequest.studentIcProvided,
      createdAt: parentVerificationRequest.createdAt,
    })
    .from(parentVerificationRequest)
    .innerJoin(users, eq(users.id, parentVerificationRequest.userId))
    .where(eq(parentVerificationRequest.status, "pending"))
    .orderBy(parentVerificationRequest.createdAt);

  return rows;
}

export async function listDepartments(): Promise<DepartmentRow[]> {
  return db
    .select({
      id: departments.id,
      code: departments.code,
      name: departments.name,
      active: departments.active,
    })
    .from(departments)
    .orderBy(departments.name);
}

export async function listRolesCatalogue(): Promise<RoleRow[]> {
  return db
    .select({ id: roles.id, code: roles.code, label: roles.label })
    .from(roles)
    .orderBy(roles.code);
}

export async function listParentsBrief(): Promise<ParentBrief[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .innerJoin(userRole, eq(userRole.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRole.roleId))
    .where(eq(roles.code, "parent"))
    .orderBy(users.name);

  return rows;
}

export async function listStudentsBrief(): Promise<StudentBrief[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, studentNo: studentProfile.studentNo })
    .from(studentProfile)
    .innerJoin(users, eq(users.id, studentProfile.userId))
    .orderBy(users.name);

  return rows;
}
