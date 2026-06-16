import { auditLog } from "@/db/schema";
import { db } from "@/lib/db";

type AuditEntry = {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function writeAudit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    metadata: entry.metadata ?? null,
  });
}
