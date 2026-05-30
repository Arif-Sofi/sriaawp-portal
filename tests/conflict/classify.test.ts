import { describe, expect, it } from "vitest";

import { classifyConflicts } from "@/lib/conflict/classify";

const t = (iso: string) => new Date(iso);

const slotA = { startAt: t("2025-06-01T09:00:00Z"), endAt: t("2025-06-01T11:00:00Z") };
const slotB = { startAt: t("2025-06-01T10:00:00Z"), endAt: t("2025-06-01T12:00:00Z") };
const slotC = { startAt: t("2025-06-01T12:00:00Z"), endAt: t("2025-06-01T14:00:00Z") };

const baseCandidate = {
  roomId: null,
  organizerUserId: null,
  deptId: null,
  priority: "normal" as const,
  audienceRefs: [],
};

describe("classifyConflicts", () => {
  it("returns no blocks when times do not overlap", () => {
    const result = classifyConflicts({
      candidate: { ...baseCandidate, roomId: "room-1" },
      candidateOccurrences: [slotC],
      otherEvents: [
        {
          id: "evt-1",
          roomId: "room-1",
          organizerUserId: null,
          priority: "normal",
          occurrences: [slotA],
          audiences: [],
        },
      ],
      blackouts: [],
    });
    expect(result).toHaveLength(0);
  });

  it("ROOM overlap => hard:true with conflicting id", () => {
    const result = classifyConflicts({
      candidate: { ...baseCandidate, roomId: "room-1" },
      candidateOccurrences: [slotA],
      otherEvents: [
        {
          id: "evt-1",
          roomId: "room-1",
          organizerUserId: null,
          priority: "normal",
          occurrences: [slotB],
          audiences: [],
        },
      ],
      blackouts: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("ROOM");
    expect(result[0].hard).toBe(true);
    expect(result[0].conflictingEventIds).toContain("evt-1");
  });

  it("ORGANIZER overlap => soft", () => {
    const result = classifyConflicts({
      candidate: { ...baseCandidate, organizerUserId: "user-1" },
      candidateOccurrences: [slotA],
      otherEvents: [
        {
          id: "evt-2",
          roomId: null,
          organizerUserId: "user-1",
          priority: "normal",
          occurrences: [slotB],
          audiences: [],
        },
      ],
      blackouts: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("ORGANIZER");
    expect(result[0].hard).toBe(false);
    expect(result[0].conflictingEventIds).toContain("evt-2");
  });

  it("AUDIENCE role overlap with normal priority => soft", () => {
    const result = classifyConflicts({
      candidate: {
        ...baseCandidate,
        priority: "normal",
        audienceRefs: [{ type: "role", ref: "teacher" }],
      },
      candidateOccurrences: [slotA],
      otherEvents: [
        {
          id: "evt-3",
          roomId: null,
          organizerUserId: null,
          priority: "normal",
          occurrences: [slotB],
          audiences: [{ type: "role", ref: "teacher" }],
        },
      ],
      blackouts: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("AUDIENCE");
    expect(result[0].hard).toBe(false);
    expect(result[0].conflictingEventIds).toContain("evt-3");
  });

  it("AUDIENCE role overlap with exam candidate priority => hard", () => {
    const result = classifyConflicts({
      candidate: {
        ...baseCandidate,
        priority: "exam",
        audienceRefs: [{ type: "role", ref: "teacher" }],
      },
      candidateOccurrences: [slotA],
      otherEvents: [
        {
          id: "evt-4",
          roomId: null,
          organizerUserId: null,
          priority: "normal",
          occurrences: [slotB],
          audiences: [{ type: "role", ref: "teacher" }],
        },
      ],
      blackouts: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("AUDIENCE");
    expect(result[0].hard).toBe(true);
  });

  it("school blackout overlap => hard", () => {
    const result = classifyConflicts({
      candidate: baseCandidate,
      candidateOccurrences: [slotA],
      otherEvents: [],
      blackouts: [{ scope: "school", deptId: null, startAt: slotB.startAt, endAt: slotB.endAt }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("BLACKOUT_SCHOOL");
    expect(result[0].hard).toBe(true);
  });

  it("dept blackout overlap => soft", () => {
    const result = classifyConflicts({
      candidate: { ...baseCandidate, deptId: "dept-1" },
      candidateOccurrences: [slotA],
      otherEvents: [],
      blackouts: [
        { scope: "department", deptId: "dept-1", startAt: slotB.startAt, endAt: slotB.endAt },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("BLACKOUT_DEPT");
    expect(result[0].hard).toBe(false);
  });

  it("deduplicates multiple conflicting event ids per kind", () => {
    const result = classifyConflicts({
      candidate: { ...baseCandidate, roomId: "room-1" },
      candidateOccurrences: [slotA],
      otherEvents: [
        {
          id: "evt-5",
          roomId: "room-1",
          organizerUserId: null,
          priority: "normal",
          occurrences: [slotA, slotB],
          audiences: [],
        },
        {
          id: "evt-6",
          roomId: "room-1",
          organizerUserId: null,
          priority: "normal",
          occurrences: [slotB],
          audiences: [],
        },
      ],
      blackouts: [],
    });
    const roomBlock = result.find((b) => b.kind === "ROOM");
    expect(roomBlock).toBeDefined();
    expect(new Set(roomBlock!.conflictingEventIds).size).toBe(
      roomBlock!.conflictingEventIds.length,
    );
    expect(roomBlock!.conflictingEventIds).toContain("evt-5");
    expect(roomBlock!.conflictingEventIds).toContain("evt-6");
  });

  it("does not raise audience conflict for public-only audiences", () => {
    const result = classifyConflicts({
      candidate: {
        ...baseCandidate,
        audienceRefs: [{ type: "public", ref: null }],
      },
      candidateOccurrences: [slotA],
      otherEvents: [
        {
          id: "evt-7",
          roomId: null,
          organizerUserId: null,
          priority: "normal",
          occurrences: [slotB],
          audiences: [{ type: "public", ref: null }],
        },
      ],
      blackouts: [],
    });
    expect(result.find((b) => b.kind === "AUDIENCE")).toBeUndefined();
  });

  it("does not include events already excluded by caller (otherEvents already filtered)", () => {
    const result = classifyConflicts({
      candidate: { ...baseCandidate, roomId: "room-1", eventId: "evt-self" },
      candidateOccurrences: [slotA],
      otherEvents: [],
      blackouts: [],
    });
    expect(result).toHaveLength(0);
  });
});
