import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { auditLog } from "@/db/schema";
import type * as schema from "@/db/schema";
import { db } from "@/lib/db";

type AuditEntry = {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Executor = Pick<PostgresJsDatabase<typeof schema>, "insert">;

export async function writeAudit(entry: AuditEntry, executor: Executor = db): Promise<void> {
  await executor.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    metadata: entry.metadata ?? null,
  });
}
