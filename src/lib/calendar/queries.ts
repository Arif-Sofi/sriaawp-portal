import { and, count, desc, eq, exists, gt, inArray, lt, or } from "drizzle-orm";

import { blackoutWindow, event, eventAudience, eventOccurrence, room } from "@/db/schema";
import { db } from "@/lib/db";
import type { SessionContext } from "@/lib/rbac/session-context";

export type CalendarOccurrence = {
  occurrenceId: string;
  eventId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  roomName: string | null;
  priority: "normal" | "exam";
};

export type CalendarBlackout = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  scope: "school" | "department";
  isHard: boolean;
};

type WindowParams = { fromISO: string; toISO: string };
type VisibleParams = WindowParams & { user: Pick<SessionContext, "roles" | "deptIds"> };

export async function listPublicOccurrences({
  fromISO,
  toISO,
}: WindowParams): Promise<CalendarOccurrence[]> {
  return db
    .select({
      occurrenceId: eventOccurrence.id,
      eventId: event.id,
      title: event.title,
      startAt: eventOccurrence.startAt,
      endAt: eventOccurrence.endAt,
      roomName: room.name,
      priority: event.priority,
    })
    .from(eventOccurrence)
    .innerJoin(event, eq(event.id, eventOccurrence.eventId))
    .leftJoin(room, eq(room.id, event.roomId))
    .where(
      and(
        eq(event.status, "published"),
        lt(eventOccurrence.startAt, new Date(toISO)),
        gt(eventOccurrence.endAt, new Date(fromISO)),
        exists(
          db
            .select({ id: eventAudience.id })
            .from(eventAudience)
            .where(
              and(eq(eventAudience.eventId, event.id), eq(eventAudience.audienceType, "public")),
            ),
        ),
      ),
    )
    .orderBy(eventOccurrence.startAt);
}

export async function listVisibleOccurrences({
  fromISO,
  toISO,
  user,
}: VisibleParams): Promise<CalendarOccurrence[]> {
  const audienceFilter = buildVisibleAudienceFilter(user);

  return db
    .select({
      occurrenceId: eventOccurrence.id,
      eventId: event.id,
      title: event.title,
      startAt: eventOccurrence.startAt,
      endAt: eventOccurrence.endAt,
      roomName: room.name,
      priority: event.priority,
    })
    .from(eventOccurrence)
    .innerJoin(event, eq(event.id, eventOccurrence.eventId))
    .leftJoin(room, eq(room.id, event.roomId))
    .where(
      and(
        eq(event.status, "published"),
        lt(eventOccurrence.startAt, new Date(toISO)),
        gt(eventOccurrence.endAt, new Date(fromISO)),
        exists(
          db
            .select({ id: eventAudience.id })
            .from(eventAudience)
            .where(and(eq(eventAudience.eventId, event.id), audienceFilter)),
        ),
      ),
    )
    .orderBy(eventOccurrence.startAt);
}

function buildVisibleAudienceFilter(user: Pick<SessionContext, "roles" | "deptIds">) {
  const { roles, deptIds } = user;

  const conditions = [eq(eventAudience.audienceType, "public") as ReturnType<typeof eq>];

  if (roles.length > 0) {
    conditions.push(
      and(
        eq(eventAudience.audienceType, "role"),
        inArray(eventAudience.audienceRef, roles as string[]),
      ) as ReturnType<typeof eq>,
    );
  }

  if (deptIds.length > 0) {
    conditions.push(
      and(
        eq(eventAudience.audienceType, "department"),
        inArray(eventAudience.audienceRef, deptIds),
      ) as ReturnType<typeof eq>,
    );
  }

  return or(...conditions);
}

export async function listBlackouts({ fromISO, toISO }: WindowParams): Promise<CalendarBlackout[]> {
  return db
    .select({
      id: blackoutWindow.id,
      title: blackoutWindow.title,
      startAt: blackoutWindow.startAt,
      endAt: blackoutWindow.endAt,
      scope: blackoutWindow.scope,
      isHard: blackoutWindow.isHard,
    })
    .from(blackoutWindow)
    .where(
      and(lt(blackoutWindow.startAt, new Date(toISO)), gt(blackoutWindow.endAt, new Date(fromISO))),
    );
}

export type ManageableEvent = {
  id: string;
  title: string;
  status: "draft" | "published" | "pending_review" | "cancelled";
  priority: "normal" | "exam";
  startAt: Date;
  endAt: Date;
  roomName: string | null;
  occurrenceCount: number;
};

type ManageableUser = { id: string; deptIds: string[] };

export async function listManageableEvents(user: ManageableUser): Promise<ManageableEvent[]> {
  const occCountSubquery = db
    .select({
      eventId: eventOccurrence.eventId,
      occCount: count(eventOccurrence.id).as("occ_count"),
    })
    .from(eventOccurrence)
    .groupBy(eventOccurrence.eventId)
    .as("occ_counts");

  const rows = await db
    .select({
      id: event.id,
      title: event.title,
      status: event.status,
      priority: event.priority,
      startAt: event.startAt,
      endAt: event.endAt,
      roomName: room.name,
      occurrenceCount: occCountSubquery.occCount,
    })
    .from(event)
    .leftJoin(room, eq(room.id, event.roomId))
    .leftJoin(occCountSubquery, eq(occCountSubquery.eventId, event.id))
    .where(
      user.deptIds.length > 0
        ? or(eq(event.organizerUserId, user.id), inArray(event.deptId, user.deptIds))
        : eq(event.organizerUserId, user.id),
    )
    .orderBy(desc(event.createdAt));

  return rows.map((row) => ({
    ...row,
    occurrenceCount: row.occurrenceCount ?? 0,
  }));
}

export type EventForEdit = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  status: "draft" | "published" | "pending_review" | "cancelled";
  priority: "normal" | "exam";
  roomId: string | null;
  organizerUserId: string | null;
  deptId: string | null;
  rrule: string | null;
  audiences: { type: "public" | "role" | "department"; ref: string | null }[];
};

export async function getEventForEdit(id: string): Promise<EventForEdit | null> {
  const [row] = await db
    .select({
      id: event.id,
      title: event.title,
      description: event.description,
      startAt: event.startAt,
      endAt: event.endAt,
      status: event.status,
      priority: event.priority,
      roomId: event.roomId,
      organizerUserId: event.organizerUserId,
      deptId: event.deptId,
      rrule: event.rrule,
    })
    .from(event)
    .where(eq(event.id, id))
    .limit(1);

  if (!row) return null;

  const audiences = await db
    .select({ type: eventAudience.audienceType, ref: eventAudience.audienceRef })
    .from(eventAudience)
    .where(eq(eventAudience.eventId, id));

  return { ...row, audiences };
}

export type RoomOption = { id: string; name: string; code: string; capacity: number | null };

export async function listRooms(): Promise<RoomOption[]> {
  return db
    .select({ id: room.id, name: room.name, code: room.code, capacity: room.capacity })
    .from(room)
    .orderBy(room.name);
}
