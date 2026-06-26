"use server";

import { and, eq } from "drizzle-orm";

import { familyLink } from "@/db/schema";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/pdpa/audit";
import { getCurrentUser } from "@/lib/rbac";
import { fail, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";

export async function recordChildView(studentUserId: string): Promise<ActionResult<void>> {
  const user = await getCurrentUser();
  if (!user) return fail("Unauthenticated", { code: "UNAUTHENTICATED" });

  const [link] = await db
    .select({ parentUserId: familyLink.parentUserId })
    .from(familyLink)
    .where(and(eq(familyLink.parentUserId, user.id), eq(familyLink.studentUserId, studentUserId)))
    .limit(1);

  if (!link) return fail("Not linked", { code: "FORBIDDEN" });

  await writeAudit({
    actorUserId: user.id,
    action: "student.view",
    resourceType: "student",
    resourceId: studentUserId,
  });

  return ok(undefined);
}
