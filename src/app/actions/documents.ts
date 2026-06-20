"use server";

import { eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { document, documentVersion } from "@/db/schema";
import { db } from "@/lib/db";
import { computeDocAclKeys } from "@/lib/documents/acl";
import { writeAudit } from "@/lib/pdpa/audit";
import { requirePermission } from "@/lib/rbac";
import { fail, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
]);

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "txt", "md"]);

function extensionFromFilename(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? (parts[parts.length - 1]?.toLowerCase() ?? "") : "";
}

function isMimeAllowed(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

function isExtensionAllowed(filename: string): boolean {
  return ALLOWED_EXTENSIONS.has(extensionFromFilename(filename));
}

export async function uploadDocument(
  formData: FormData,
): Promise<ActionResult<{ documentId: string }>> {
  const user = await requirePermission("document:upload");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("File is required", { fieldErrors: { file: "File is required" } });
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return fail("Title is required", { fieldErrors: { title: "Title is required" } });
  }

  if (file.size > MAX_FILE_SIZE) {
    return fail("File exceeds 25 MB", { fieldErrors: { file: "File exceeds 25 MB" } });
  }

  if (!isMimeAllowed(file.type) || !isExtensionAllowed(file.name)) {
    return fail("File type not allowed. Accepted: pdf, docx, xlsx, txt, md", {
      fieldErrors: { file: "File type not allowed" },
    });
  }

  const visibilityRaw = formData.get("visibility");
  const VALID_VISIBILITIES = ["public", "internal", "role_list"] as const;
  type Visibility = (typeof VALID_VISIBILITIES)[number];

  if (!VALID_VISIBILITIES.includes(visibilityRaw as Visibility)) {
    return fail("Invalid visibility", { fieldErrors: { visibility: "Invalid visibility" } });
  }

  const visibility = visibilityRaw as Visibility;
  const visibilityRolesRaw = String(formData.get("visibilityRoles") ?? "").trim();
  const visibilityRoles = visibilityRolesRaw
    ? visibilityRolesRaw
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
    : null;
  const deptId = String(formData.get("deptId") ?? "").trim() || null;

  const aclKeys = computeDocAclKeys({ visibility, visibilityRoles, deptId });
  const buffer = Buffer.from(await file.arrayBuffer());

  const documentId = await db.transaction(async (tx) => {
    const [docRow] = await tx
      .insert(document)
      .values({
        title,
        description: String(formData.get("description") ?? "").trim() || null,
        visibility,
        visibilityRoles,
        deptId,
        aclKeys,
        uploadedByUserId: user.id,
        currentVersionId: null,
      })
      .returning({ id: document.id });

    const [versionRow] = await tx
      .insert(documentVersion)
      .values({
        documentId: docRow.id,
        versionNo: 1,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        content: buffer,
        uploadedByUserId: user.id,
      })
      .returning({ id: documentVersion.id });

    await tx
      .update(document)
      .set({ currentVersionId: versionRow.id, updatedAt: new Date() })
      .where(eq(document.id, docRow.id));

    await writeAudit(
      {
        actorUserId: user.id,
        action: "document.upload",
        resourceType: "document",
        resourceId: docRow.id,
        metadata: { filename: file.name, sizeBytes: file.size },
      },
      tx,
    );

    return docRow.id;
  });

  revalidatePath("/admin/documents");
  revalidatePath("/staff/documents");
  return ok({ documentId });
}

export async function replaceVersion(
  documentId: string,
  formData: FormData,
): Promise<ActionResult<{ versionId: string }>> {
  const user = await requirePermission("document:edit");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("File is required", { fieldErrors: { file: "File is required" } });
  }

  if (file.size > MAX_FILE_SIZE) {
    return fail("File exceeds 25 MB", { fieldErrors: { file: "File exceeds 25 MB" } });
  }

  if (!isMimeAllowed(file.type) || !isExtensionAllowed(file.name)) {
    return fail("File type not allowed. Accepted: pdf, docx, xlsx, txt, md", {
      fieldErrors: { file: "File type not allowed" },
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const versionId = await db.transaction(async (tx) => {
    const [maxRow] = await tx
      .select({ maxNo: max(documentVersion.versionNo) })
      .from(documentVersion)
      .where(eq(documentVersion.documentId, documentId));

    const nextVersionNo = (maxRow?.maxNo ?? 0) + 1;

    const [versionRow] = await tx
      .insert(documentVersion)
      .values({
        documentId,
        versionNo: nextVersionNo,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        content: buffer,
        uploadedByUserId: user.id,
      })
      .returning({ id: documentVersion.id });

    await tx
      .update(document)
      .set({ currentVersionId: versionRow.id, updatedAt: new Date() })
      .where(eq(document.id, documentId));

    await writeAudit(
      {
        actorUserId: user.id,
        action: "document.replace_version",
        resourceType: "document",
        resourceId: documentId,
        metadata: { filename: file.name, versionNo: nextVersionNo },
      },
      tx,
    );

    return versionRow.id;
  });

  revalidatePath("/admin/documents");
  revalidatePath("/staff/documents");
  return ok({ versionId });
}

export async function deleteDocument(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission("document:delete");

  const [row] = await db.delete(document).where(eq(document.id, id)).returning({ id: document.id });

  if (!row) return fail("Document not found", { code: "NOT_FOUND" });

  await writeAudit({
    actorUserId: user.id,
    action: "document.delete",
    resourceType: "document",
    resourceId: id,
  });

  revalidatePath("/admin/documents");
  revalidatePath("/staff/documents");
  return ok(undefined);
}
