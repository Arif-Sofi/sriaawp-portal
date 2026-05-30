import { and, eq, exists, gt, inArray, lt, or } from "drizzle-orm";

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
