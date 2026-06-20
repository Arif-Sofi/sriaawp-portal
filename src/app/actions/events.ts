"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { event, eventAudience, eventOccurrence } from "@/db/schema";
import { db } from "@/lib/db";
import { detectConflicts } from "@/lib/conflict";
import type { ConflictBlock } from "@/lib/conflict/classify";
import { expandOccurrences } from "@/lib/conflict/rrule";
import { writeAudit } from "@/lib/pdpa/audit";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { fail, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";

type AudienceRef = {
  type: "public" | "role" | "department";
  ref: string | null;
};

type CreateEventInput = {
  title: string;
  description?: string;
  startISO: string;
  endISO: string;
  roomId?: string;
  organizerUserId?: string;
  deptId?: string;
  priority?: "normal" | "exam";
  audiences: AudienceRef[];
  rrule?: string;
  override?: { reason: string };
};

type CreateEventData = {
  eventId: string | null;
  status: string;
  blocks: ConflictBlock[];
  outcome: "PUBLISHED" | "PENDING_REVIEW" | "BLOCKED_HARD";
};

export async function createEvent(input: CreateEventInput): Promise<ActionResult<CreateEventData>> {
  const user = await requirePermission("event:create");

  if (!input.title.trim()) {
    return fail("Title is required", { fieldErrors: { title: "Title is required" } });
  }

  const startAt = new Date(input.startISO);
  const endAt = new Date(input.endISO);

  if (endAt <= startAt) {
    return fail("End must be after start", { fieldErrors: { endISO: "End must be after start" } });
  }

  const organizerUserId = input.organizerUserId ?? user.id;
  const windowEnd = new Date(startAt);
  windowEnd.setFullYear(windowEnd.getFullYear() + 1);

  const occurrences = expandOccurrences(
    { startAt, endAt, rrule: input.rrule ?? null },
    { windowEndISO: windowEnd.toISOString() },
  );

  const candidate = {
    eventId: undefined as string | undefined,
    roomId: input.roomId ?? null,
    organizerUserId,
    deptId: input.deptId ?? null,
    priority: input.priority ?? "normal",
    audienceRefs: input.audiences,
  };

  return db.transaction(async (tx) => {
    const blocks = await detectConflicts(tx, candidate, occurrences);
    const hasHard = blocks.some((b) => b.hard);

    if (hasHard && !input.override) {
      return ok<CreateEventData>({
        eventId: null,
        status: "blocked",
        blocks,
        outcome: "BLOCKED_HARD",
      });
    }

    if (hasHard && input.override && !hasPermission(user, "event:override_conflict")) {
      return fail("You do not have permission to override conflicts", {
        code: "FORBIDDEN",
      });
    }

    const eventStatus = hasHard || blocks.length > 0 ? "pending_review" : "published";

    const [newEvent] = await tx
      .insert(event)
      .values({
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        startAt,
        endAt,
        roomId: input.roomId ?? null,
        organizerUserId,
        deptId: input.deptId ?? null,
        priority: input.priority ?? "normal",
        status: eventStatus,
        rrule: input.rrule ?? null,
      })
      .returning();

    await tx.insert(eventOccurrence).values(
      occurrences.map((occ) => ({
        eventId: newEvent.id,
        startAt: occ.startAt,
        endAt: occ.endAt,
      })),
    );

    if (input.audiences.length > 0) {
      await tx.insert(eventAudience).values(
        input.audiences.map((a) => ({
          eventId: newEvent.id,
          audienceType: a.type,
          audienceRef: a.ref,
        })),
      );
    }

    await writeAudit(
      {
        actorUserId: user.id,
        action: "event.create",
        resourceType: "event",
        resourceId: newEvent.id,
        metadata: { status: eventStatus, occurrenceCount: occurrences.length },
      },
      tx,
    );

    if (hasHard && input.override) {
      await writeAudit(
        {
          actorUserId: user.id,
          action: "event.override",
          resourceType: "event",
          resourceId: newEvent.id,
          metadata: { reason: input.override.reason, blocks },
        },
        tx,
      );
    }

    const outcome: "PUBLISHED" | "PENDING_REVIEW" =
      eventStatus === "published" ? "PUBLISHED" : "PENDING_REVIEW";

    revalidatePath("/staff/events");
    revalidatePath("/takwim");
    return ok<CreateEventData>({
      eventId: newEvent.id,
      status: eventStatus,
      blocks,
      outcome,
    });
  });
}

export async function publishPendingEvent(
  id: string,
  reason?: string,
): Promise<ActionResult<void>> {
  const user = await requirePermission("event:override_conflict");

  const [row] = await db
    .update(event)
    .set({ status: "published", updatedAt: new Date() })
    .where(and(eq(event.id, id), eq(event.status, "pending_review")))
    .returning({ id: event.id });

  if (!row) return fail("Event not found or not in pending_review status", { code: "NOT_FOUND" });

  await writeAudit({
    actorUserId: user.id,
    action: "event.publish",
    resourceType: "event",
    resourceId: id,
    metadata: reason ? { reason } : null,
  });

  revalidatePath("/staff/events");
  revalidatePath(`/staff/events/${id}`);
  revalidatePath("/takwim");
  return ok(undefined);
}

export async function updateEvent(
  id: string,
  input: { title: string; description?: string },
): Promise<ActionResult<void>> {
  const user = await requirePermission("event:edit");

  const title = input.title.trim();
  if (!title) return fail("Title is required", { fieldErrors: { title: "Title is required" } });

  const [row] = await db
    .update(event)
    .set({ title, description: input.description?.trim() || null, updatedAt: new Date() })
    .where(eq(event.id, id))
    .returning({ id: event.id });

  if (!row) return fail("Event not found", { code: "NOT_FOUND" });

  await writeAudit({
    actorUserId: user.id,
    action: "event.update",
    resourceType: "event",
    resourceId: id,
    metadata: null,
  });

  revalidatePath("/staff/events");
  revalidatePath(`/staff/events/${id}`);
  revalidatePath("/takwim");
  return ok(undefined);
}
