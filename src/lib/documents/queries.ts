import { arrayOverlaps, desc, eq } from "drizzle-orm";

import { document, documentVersion } from "@/db/schema";
import { db } from "@/lib/db";
import type { AuthedUser } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac";
import { computeUserAclKeys } from "./acl";

type DocumentRow = typeof document.$inferSelect;

export type DocumentWithVersion = DocumentRow & {
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  versionNo: number | null;
};

export async function listVisibleDocuments(
  user: Pick<AuthedUser, "roles" | "deptIds" | "permissions">,
): Promise<DocumentWithVersion[]> {
  const aclKeys = computeUserAclKeys(user);
  return db
    .select({
      id: document.id,
      title: document.title,
      description: document.description,
      visibility: document.visibility,
      visibilityRoles: document.visibilityRoles,
      deptId: document.deptId,
      aclKeys: document.aclKeys,
      uploadedByUserId: document.uploadedByUserId,
      currentVersionId: document.currentVersionId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      filename: documentVersion.filename,
      mimeType: documentVersion.mimeType,
      sizeBytes: documentVersion.sizeBytes,
      versionNo: documentVersion.versionNo,
    })
    .from(document)
    .leftJoin(documentVersion, eq(document.currentVersionId, documentVersion.id))
    .where(arrayOverlaps(document.aclKeys, aclKeys))
    .orderBy(desc(document.createdAt));
}

export async function listAllDocuments(): Promise<DocumentWithVersion[]> {
  return db
    .select({
      id: document.id,
      title: document.title,
      description: document.description,
      visibility: document.visibility,
      visibilityRoles: document.visibilityRoles,
      deptId: document.deptId,
      aclKeys: document.aclKeys,
      uploadedByUserId: document.uploadedByUserId,
      currentVersionId: document.currentVersionId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      filename: documentVersion.filename,
      mimeType: documentVersion.mimeType,
      sizeBytes: documentVersion.sizeBytes,
      versionNo: documentVersion.versionNo,
    })
    .from(document)
    .leftJoin(documentVersion, eq(document.currentVersionId, documentVersion.id))
    .orderBy(desc(document.createdAt));
}

type DownloadResult = {
  filename: string;
  mimeType: string;
  content: Buffer;
};

export async function getDocumentForDownload({
  id,
  user,
}: {
  id: string;
  user: Pick<AuthedUser, "roles" | "deptIds" | "permissions">;
}): Promise<DownloadResult | null> {
  const [row] = await db
    .select({
      aclKeys: document.aclKeys,
      filename: documentVersion.filename,
      mimeType: documentVersion.mimeType,
      content: documentVersion.content,
    })
    .from(document)
    .innerJoin(documentVersion, eq(document.currentVersionId, documentVersion.id))
    .where(eq(document.id, id))
    .limit(1);

  if (!row) return null;

  const userAclKeys = computeUserAclKeys(user);
  const canAccess =
    row.aclKeys.some((k) => userAclKeys.includes(k)) || hasPermission(user, "document:edit");

  if (!canAccess) return null;
  if (!row.filename || !row.mimeType || !row.content) return null;

  return {
    filename: row.filename,
    mimeType: row.mimeType,
    content: row.content as unknown as Buffer,
  };
}
