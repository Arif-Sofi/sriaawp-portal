"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  departments,
  familyLink,
  parentVerificationRequest,
  roles,
  studentProfile,
  userRole,
  users,
} from "@/db/schema";
import { GLOBAL_SCOPE_SENTINEL } from "@/db/schema/rbac";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/pdpa/audit";
import { requirePermission } from "@/lib/rbac";
import { fail, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";

type AssignRoleInput = {
  userId: string;
  roleCode: string;
  deptId?: string;
};

type RevokeRoleInput = {
  userId: string;
  roleCode: string;
  scopeId: string;
};

type LinkFamilyInput = {
  parentUserId: string;
  studentUserId: string;
  relationship: "father" | "mother" | "guardian";
  primaryContact?: boolean;
};

type BulkLinkSummary = {
  created: number;
  skipped: number;
  errors: string[];
};

type CreateDepartmentInput = {
  code: string;
  name: string;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function assignRole(input: AssignRoleInput): Promise<ActionResult<void>> {
  const caller = await requirePermission("user:manage_roles");

  const [roleRow] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, input.roleCode))
    .limit(1);

  if (!roleRow) return fail("Role not found", { code: "NOT_FOUND" });

  if (input.deptId) {
    const [deptRow] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, input.deptId))
      .limit(1);

    if (!deptRow)
      return fail("Unknown department", { fieldErrors: { deptId: "Unknown department" } });
  }

  const scopeType = input.deptId ? "department" : "global";
  const scopeId = input.deptId ?? GLOBAL_SCOPE_SENTINEL;

  await db
    .insert(userRole)
    .values({ userId: input.userId, roleId: roleRow.id, scopeType, scopeId })
    .onConflictDoNothing();

  await writeAudit({
    actorUserId: caller.id,
    action: "user.assign_role",
    resourceType: "user",
    resourceId: input.userId,
    metadata: { roleCode: input.roleCode, scopeType, scopeId },
  });

  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function revokeRole(input: RevokeRoleInput): Promise<ActionResult<void>> {
  const caller = await requirePermission("user:manage_roles");

  const [roleRow] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, input.roleCode))
    .limit(1);

  if (!roleRow) return fail("Role not found", { code: "NOT_FOUND" });

  const scopeType = input.scopeId === GLOBAL_SCOPE_SENTINEL ? "global" : "department";

  await db
    .delete(userRole)
    .where(
      and(
        eq(userRole.userId, input.userId),
        eq(userRole.roleId, roleRow.id),
        eq(userRole.scopeType, scopeType),
        eq(userRole.scopeId, input.scopeId),
      ),
    );

  await writeAudit({
    actorUserId: caller.id,
    action: "user.revoke_role",
    resourceType: "user",
    resourceId: input.userId,
    metadata: { roleCode: input.roleCode, scopeId: input.scopeId },
  });

  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function approveParent(requestId: string): Promise<ActionResult<void>> {
  const caller = await requirePermission("user:verify_parent");

  return db.transaction(async (tx) => {
    const [request] = await tx
      .select({ id: parentVerificationRequest.id, userId: parentVerificationRequest.userId })
      .from(parentVerificationRequest)
      .where(eq(parentVerificationRequest.id, requestId))
      .limit(1);

    if (!request) return fail("Request not found", { code: "NOT_FOUND" });

    await tx
      .update(parentVerificationRequest)
      .set({ status: "approved", reviewerUserId: caller.id, reviewedAt: new Date() })
      .where(eq(parentVerificationRequest.id, requestId));

    await writeAudit(
      {
        actorUserId: caller.id,
        action: "user.verify_parent",
        resourceType: "parent_verification_request",
        resourceId: requestId,
        metadata: { decision: "approved" },
      },
      tx,
    );

    revalidatePath("/admin/verify");
    revalidatePath("/admin/users");
    return ok(undefined);
  });
}

type RejectParentInput = {
  requestId: string;
  reason?: string;
};

export async function rejectParent(input: RejectParentInput): Promise<ActionResult<void>> {
  const caller = await requirePermission("user:verify_parent");

  return db.transaction(async (tx) => {
    const [request] = await tx
      .select({ id: parentVerificationRequest.id })
      .from(parentVerificationRequest)
      .where(eq(parentVerificationRequest.id, input.requestId))
      .limit(1);

    if (!request) return fail("Request not found", { code: "NOT_FOUND" });

    await tx
      .update(parentVerificationRequest)
      .set({
        status: "rejected",
        reviewerUserId: caller.id,
        reviewedAt: new Date(),
        notes: input.reason ?? null,
      })
      .where(eq(parentVerificationRequest.id, input.requestId));

    await writeAudit(
      {
        actorUserId: caller.id,
        action: "user.verify_parent",
        resourceType: "parent_verification_request",
        resourceId: input.requestId,
        metadata: { decision: "rejected", reason: input.reason ?? null },
      },
      tx,
    );

    revalidatePath("/admin/verify");
    return ok(undefined);
  });
}

export async function linkFamily(
  input: LinkFamilyInput,
): Promise<ActionResult<{ created: boolean }>> {
  const caller = await requirePermission("user:link_family");

  const inserted = await db
    .insert(familyLink)
    .values({
      parentUserId: input.parentUserId,
      studentUserId: input.studentUserId,
      relationship: input.relationship,
      primaryContact: input.primaryContact ?? false,
    })
    .onConflictDoNothing()
    .returning({ parentUserId: familyLink.parentUserId });

  const created = inserted.length > 0;

  if (created) {
    await writeAudit({
      actorUserId: caller.id,
      action: "user.link_family",
      resourceType: "family_link",
      resourceId: input.parentUserId,
      metadata: {
        studentUserId: input.studentUserId,
        relationship: input.relationship,
      },
    });
  }

  revalidatePath("/admin/family-links");
  return ok({ created });
}

type CsvRow = {
  parentEmail: string;
  studentNo: string;
  relationship: string;
  lineNumber: number;
};

function parseCsvRows(csvText: string): CsvRow[] {
  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];

  return lines.slice(1).map((line, index) => {
    const parts = line.split(",").map((p) => p.trim());
    return {
      parentEmail: parts[0] ?? "",
      studentNo: parts[1] ?? "",
      relationship: parts[2] ?? "",
      lineNumber: index + 2,
    };
  });
}

const VALID_RELATIONSHIPS = new Set(["father", "mother", "guardian"]);

type RowOutcome = { kind: "created" | "skipped" | "error"; error?: string };

async function processLinkRow(row: CsvRow): Promise<RowOutcome> {
  if (!row.parentEmail || !row.studentNo || !row.relationship) {
    return { kind: "error", error: `Line ${row.lineNumber}: missing required field` };
  }

  if (!VALID_RELATIONSHIPS.has(row.relationship)) {
    return {
      kind: "error",
      error: `Line ${row.lineNumber}: invalid relationship "${row.relationship}" (father|mother|guardian)`,
    };
  }

  const [parentUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, row.parentEmail))
    .limit(1);

  if (!parentUser) {
    return {
      kind: "error",
      error: `Line ${row.lineNumber}: parent email not found "${row.parentEmail}"`,
    };
  }

  const [student] = await db
    .select({ userId: studentProfile.userId })
    .from(studentProfile)
    .where(eq(studentProfile.studentNo, row.studentNo))
    .limit(1);

  if (!student) {
    return {
      kind: "error",
      error: `Line ${row.lineNumber}: student no. not found "${row.studentNo}"`,
    };
  }

  const inserted = await db
    .insert(familyLink)
    .values({
      parentUserId: parentUser.id,
      studentUserId: student.userId,
      relationship: row.relationship as "father" | "mother" | "guardian",
      primaryContact: false,
    })
    .onConflictDoNothing()
    .returning({ parentUserId: familyLink.parentUserId });

  return inserted.length === 0 ? { kind: "skipped" } : { kind: "created" };
}

export async function bulkLinkFamilyCsv(csvText: string): Promise<ActionResult<BulkLinkSummary>> {
  const caller = await requirePermission("user:link_family");

  const rows = parseCsvRows(csvText);
  // Sequential to avoid overwhelming DB connections
  const outcomes: RowOutcome[] = [];
  for (const row of rows) {
    const outcome = await processLinkRow(row);
    outcomes.push(outcome);
  }

  const created = outcomes.filter((o) => o.kind === "created").length;
  const skipped = outcomes.filter((o) => o.kind === "skipped").length;
  const errors = outcomes.filter((o) => o.kind === "error").map((o) => o.error ?? "");

  await writeAudit({
    actorUserId: caller.id,
    action: "user.bulk_link_family",
    resourceType: "family_link",
    metadata: { created, skipped, errorCount: errors.length },
  });

  revalidatePath("/admin/family-links");
  return ok({ created, skipped, errors });
}

export async function createDepartment(input: CreateDepartmentInput): Promise<ActionResult<void>> {
  const caller = await requirePermission("department:manage");

  if (!input.code.trim()) {
    return fail("Code is required", { fieldErrors: { code: "Code is required" } });
  }
  if (!input.name.trim()) {
    return fail("Name is required", { fieldErrors: { name: "Name is required" } });
  }

  try {
    const [row] = await db
      .insert(departments)
      .values({ code: input.code.trim(), name: input.name.trim() })
      .returning({ id: departments.id });

    await writeAudit({
      actorUserId: caller.id,
      action: "department.create",
      resourceType: "department",
      resourceId: row.id,
      metadata: { code: input.code.trim(), name: input.name.trim() },
    });

    revalidatePath("/admin/departments");
    return ok(undefined);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("Department code already exists", {
        fieldErrors: { code: "Code already in use" },
      });
    }
    throw error;
  }
}
