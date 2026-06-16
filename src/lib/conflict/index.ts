import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { blackoutWindow, event, eventAudience, eventOccurrence } from "@/db/schema";
import type * as schema from "@/db/schema";
import { classifyConflicts, type ConflictBlock } from "./classify";

type Tx = PostgresJsDatabase<typeof schema>;

type CandidateInput = {
  eventId?: string;
  roomId: string | null;
  organizerUserId: string | null;
  deptId: string | null;
  priority: "normal" | "exam";
  audienceRefs: { type: "public" | "role" | "department"; ref: string | null }[];
};

export async function detectConflicts(
  tx: Tx,
  candidate: CandidateInput,
  candidateOccurrences: { startAt: Date; endAt: Date }[],
): Promise<ConflictBlock[]> {
  if (candidateOccurrences.length === 0) return [];

  const windowStart = candidateOccurrences.reduce(
    (min, o) => (o.startAt < min ? o.startAt : min),
    candidateOccurrences[0].startAt,
  );
  const windowEnd = candidateOccurrences.reduce(
    (max, o) => (o.endAt > max ? o.endAt : max),
    candidateOccurrences[0].endAt,
  );

  const overlapCondition = and(
    lt(eventOccurrence.startAt, windowEnd),
    gt(eventOccurrence.endAt, windowStart),
  );

  const publishedFilter = and(eq(event.status, "published"), overlapCondition);
  const withExclusion = candidate.eventId
    ? and(publishedFilter, ne(event.id, candidate.eventId))
    : publishedFilter;

  const occurrenceRows = await tx
    .select({
      eventId: event.id,
      roomId: event.roomId,
      organizerUserId: event.organizerUserId,
      priority: event.priority,
      occStartAt: eventOccurrence.startAt,
      occEndAt: eventOccurrence.endAt,
    })
    .from(eventOccurrence)
    .innerJoin(event, eq(event.id, eventOccurrence.eventId))
    .where(withExclusion);

  const eventIds = Array.from(new Set(occurrenceRows.map((r) => r.eventId)));

  const audienceRows =
    eventIds.length > 0
      ? await tx
          .select({
            eventId: eventAudience.eventId,
            type: eventAudience.audienceType,
            ref: eventAudience.audienceRef,
          })
          .from(eventAudience)
          .where(inArray(eventAudience.eventId, eventIds))
      : [];

  const audienceMap = new Map<
    string,
    { type: "public" | "role" | "department"; ref: string | null }[]
  >();
  for (const row of audienceRows) {
    const existing = audienceMap.get(row.eventId) ?? [];
    existing.push({ type: row.type, ref: row.ref });
    audienceMap.set(row.eventId, existing);
  }

  const occurrenceMap = new Map<string, { startAt: Date; endAt: Date }[]>();
  for (const row of occurrenceRows) {
    const existing = occurrenceMap.get(row.eventId) ?? [];
    existing.push({ startAt: row.occStartAt, endAt: row.occEndAt });
    occurrenceMap.set(row.eventId, existing);
  }

  const eventMeta = new Map<
    string,
    { roomId: string | null; organizerUserId: string | null; priority: "normal" | "exam" }
  >();
  for (const row of occurrenceRows) {
    if (!eventMeta.has(row.eventId)) {
      eventMeta.set(row.eventId, {
        roomId: row.roomId,
        organizerUserId: row.organizerUserId,
        priority: row.priority,
      });
    }
  }

  const otherEvents = eventIds.map((id) => {
    const meta = eventMeta.get(id)!;
    return {
      id,
      roomId: meta.roomId,
      organizerUserId: meta.organizerUserId,
      priority: meta.priority,
      occurrences: occurrenceMap.get(id) ?? [],
      audiences: audienceMap.get(id) ?? [],
    };
  });

  const blackoutRows = await tx
    .select({
      scope: blackoutWindow.scope,
      deptId: blackoutWindow.deptId,
      startAt: blackoutWindow.startAt,
      endAt: blackoutWindow.endAt,
    })
    .from(blackoutWindow)
    .where(and(lt(blackoutWindow.startAt, windowEnd), gt(blackoutWindow.endAt, windowStart)));

  return classifyConflicts({
    candidate,
    candidateOccurrences,
    otherEvents,
    blackouts: blackoutRows,
  });
}
