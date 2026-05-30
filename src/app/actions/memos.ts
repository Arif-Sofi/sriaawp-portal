"use server";

import { eq } from "drizzle-orm";

import { memo } from "@/db/schema";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/pdpa/audit";
import { requirePermission } from "@/lib/rbac";
import { fail, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";

type MemoInput = {
  title: string;
  body: string;
  visibility?: "internal" | "role_list";
  visibilityRoles?: string[];
  deptId?: string;
  pinned?: boolean;
};

type MemoRow = typeof memo.$inferSelect;

export async function createMemo(input: MemoInput): Promise<ActionResult<MemoRow>> {
  const user = await requirePermission("memo:author");

  if (!input.title.trim()) {
    return fail("Title is required", { fieldErrors: { title: "Title is required" } });
  }
  if (!input.body.trim()) {
    return fail("Body is required", { fieldErrors: { body: "Body is required" } });
  }

  const [row] = await db
    .insert(memo)
    .values({
      title: input.title.trim(),
      body: input.body.trim(),
      visibility: input.visibility ?? "internal",
      visibilityRoles: input.visibilityRoles ?? null,
      deptId: input.deptId ?? null,
      authorUserId: user.id,
      pinned: input.pinned ?? false,
      publishedAt: new Date(),
    })
    .returning();

  await writeAudit({
    actorUserId: user.id,
    action: "memo.create",
    resourceType: "memo",
    resourceId: row.id,
  });

  return ok(row);
}

export async function updateMemo(
  id: string,
  input: Partial<MemoInput>,
): Promise<ActionResult<MemoRow>> {
  const user = await requirePermission("memo:author");

  if (input.title !== undefined && !input.title.trim()) {
    return fail("Title is required", { fieldErrors: { title: "Title is required" } });
  }
  if (input.body !== undefined && !input.body.trim()) {
    return fail("Body is required", { fieldErrors: { body: "Body is required" } });
  }

  const updates: Partial<typeof memo.$inferInsert> = {};
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.body !== undefined) updates.body = input.body.trim();
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.visibilityRoles !== undefined) updates.visibilityRoles = input.visibilityRoles;
  if (input.deptId !== undefined) updates.deptId = input.deptId;
  if (input.pinned !== undefined) updates.pinned = input.pinned;
  updates.updatedAt = new Date();

  const [row] = await db.update(memo).set(updates).where(eq(memo.id, id)).returning();
  if (!row) return fail("Memo not found", { code: "NOT_FOUND" });

  await writeAudit({
    actorUserId: user.id,
    action: "memo.update",
    resourceType: "memo",
    resourceId: id,
  });

  return ok(row);
}

export async function deleteMemo(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission("memo:author");

  const [row] = await db.delete(memo).where(eq(memo.id, id)).returning({ id: memo.id });
  if (!row) return fail("Memo not found", { code: "NOT_FOUND" });

  await writeAudit({
    actorUserId: user.id,
    action: "memo.delete",
    resourceType: "memo",
    resourceId: id,
  });

  return ok(undefined);
}
