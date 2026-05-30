export type ConflictKind = "ROOM" | "ORGANIZER" | "AUDIENCE" | "BLACKOUT_DEPT" | "BLACKOUT_SCHOOL";

export type ConflictBlock = {
  kind: ConflictKind;
  hard: boolean;
  detail: string;
  conflictingEventIds: string[];
};

type TimeRange = { startAt: Date; endAt: Date };

type AudienceRef = {
  type: "public" | "role" | "department";
  ref: string | null;
};

type CandidateInput = {
  eventId?: string;
  roomId: string | null;
  organizerUserId: string | null;
  deptId: string | null;
  priority: "normal" | "exam";
  audienceRefs: AudienceRef[];
};

type OtherEvent = {
  id: string;
  roomId: string | null;
  organizerUserId: string | null;
  priority: "normal" | "exam";
  occurrences: TimeRange[];
  audiences: AudienceRef[];
};

type Blackout = {
  scope: "school" | "department";
  deptId: string | null;
  startAt: Date;
  endAt: Date;
};

type ClassifyInput = {
  candidate: CandidateInput;
  candidateOccurrences: TimeRange[];
  otherEvents: OtherEvent[];
  blackouts: Blackout[];
};

function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

function anyOverlap(ranges: TimeRange[], others: TimeRange[]): boolean {
  return ranges.some((r) => others.some((o) => overlaps(r, o)));
}

function dedup(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

export function classifyConflicts({
  candidate,
  candidateOccurrences,
  otherEvents,
  blackouts,
}: ClassifyInput): ConflictBlock[] {
  const blocks: ConflictBlock[] = [];

  const schoolBlackouts = blackouts.filter((b) => b.scope === "school");
  const hasSchoolConflict = schoolBlackouts.some((b) =>
    candidateOccurrences.some((occ) => overlaps(occ, b)),
  );
  if (hasSchoolConflict) {
    blocks.push({
      kind: "BLACKOUT_SCHOOL",
      hard: true,
      detail: "One or more occurrences fall within a school-wide blackout window.",
      conflictingEventIds: [],
    });
  }

  if (candidate.deptId) {
    const deptBlackouts = blackouts.filter(
      (b) => b.scope === "department" && b.deptId === candidate.deptId,
    );
    const hasDeptConflict = deptBlackouts.some((b) =>
      candidateOccurrences.some((occ) => overlaps(occ, b)),
    );
    if (hasDeptConflict) {
      blocks.push({
        kind: "BLACKOUT_DEPT",
        hard: false,
        detail: "One or more occurrences fall within a department blackout window.",
        conflictingEventIds: [],
      });
    }
  }

  if (candidate.roomId) {
    const roomConflictIds: string[] = [];
    for (const other of otherEvents) {
      if (other.roomId !== candidate.roomId) continue;
      if (!anyOverlap(candidateOccurrences, other.occurrences)) continue;
      roomConflictIds.push(other.id);
    }
    if (roomConflictIds.length > 0) {
      blocks.push({
        kind: "ROOM",
        hard: true,
        detail: `Room is already booked by ${roomConflictIds.length} other event(s).`,
        conflictingEventIds: dedup(roomConflictIds),
      });
    }
  }

  if (candidate.organizerUserId) {
    const organizerConflictIds: string[] = [];
    for (const other of otherEvents) {
      if (other.organizerUserId !== candidate.organizerUserId) continue;
      if (!anyOverlap(candidateOccurrences, other.occurrences)) continue;
      organizerConflictIds.push(other.id);
    }
    if (organizerConflictIds.length > 0) {
      blocks.push({
        kind: "ORGANIZER",
        hard: false,
        detail: `Organizer has ${organizerConflictIds.length} other event(s) at the same time.`,
        conflictingEventIds: dedup(organizerConflictIds),
      });
    }
  }

  const nonPublicAudiences = candidate.audienceRefs.filter((a) => a.type !== "public");
  if (nonPublicAudiences.length > 0) {
    const audienceConflictIds: string[] = [];
    for (const other of otherEvents) {
      if (!anyOverlap(candidateOccurrences, other.occurrences)) continue;
      const hasAudienceOverlap = nonPublicAudiences.some((ca) =>
        other.audiences.some(
          (oa) =>
            oa.type === ca.type && oa.type !== "public" && oa.ref !== null && oa.ref === ca.ref,
        ),
      );
      if (!hasAudienceOverlap) continue;
      audienceConflictIds.push(other.id);
    }
    if (audienceConflictIds.length > 0) {
      const isHard =
        candidate.priority === "exam" ||
        otherEvents.some((e) => audienceConflictIds.includes(e.id) && e.priority === "exam");
      blocks.push({
        kind: "AUDIENCE",
        hard: isHard,
        detail: `${audienceConflictIds.length} event(s) share the same audience at the same time.`,
        conflictingEventIds: dedup(audienceConflictIds),
      });
    }
  }

  return blocks;
}
