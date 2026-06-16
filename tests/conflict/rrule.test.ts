import { describe, expect, it } from "vitest";

import { expandOccurrences, parseRrule, serializeRrule } from "@/lib/conflict/rrule";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const base = {
  startAt: new Date("2025-01-06T09:00:00Z"),
  endAt: new Date("2025-01-06T10:00:00Z"),
};

const windowEndISO = "2026-01-06T09:00:00Z";

describe("serializeRrule / parseRrule", () => {
  it("round-trips WEEKLY with COUNT", () => {
    const rule = { freq: "WEEKLY" as const, interval: 1, count: 10 };
    expect(parseRrule(serializeRrule(rule))).toEqual(rule);
  });

  it("round-trips DAILY with UNTIL", () => {
    const rule = { freq: "DAILY" as const, interval: 2, untilISO: "2025-12-31T00:00:00Z" };
    expect(parseRrule(serializeRrule(rule))).toEqual(rule);
  });

  it("returns null for null input", () => {
    expect(parseRrule(null)).toBeNull();
  });

  it("returns null for invalid FREQ", () => {
    expect(parseRrule("FREQ=HOURLY;INTERVAL=1")).toBeNull();
  });
});

describe("expandOccurrences", () => {
  it("returns single occurrence when rrule is null", () => {
    const result = expandOccurrences({ ...base, rrule: null }, { windowEndISO });
    expect(result).toHaveLength(1);
    expect(result[0].startAt).toEqual(base.startAt);
    expect(result[0].endAt).toEqual(base.endAt);
  });

  it("expands WEEKLY COUNT=4 with correct spacing and duration", () => {
    const result = expandOccurrences(
      { ...base, rrule: "FREQ=WEEKLY;INTERVAL=1;COUNT=4" },
      { windowEndISO },
    );
    expect(result).toHaveLength(4);
    expect(result[1].startAt.getTime() - result[0].startAt.getTime()).toBe(7 * DAY_MS);
    expect(result[2].startAt.getTime() - result[1].startAt.getTime()).toBe(7 * DAY_MS);
    expect(result[3].startAt.getTime() - result[2].startAt.getTime()).toBe(7 * DAY_MS);
    for (const occ of result) {
      expect(occ.endAt.getTime() - occ.startAt.getTime()).toBe(HOUR_MS);
    }
  });

  it("expands MONTHLY INTERVAL=1 COUNT=3", () => {
    const result = expandOccurrences(
      { ...base, rrule: "FREQ=MONTHLY;INTERVAL=1;COUNT=3" },
      { windowEndISO },
    );
    expect(result).toHaveLength(3);
    expect(result[1].startAt.getMonth()).toBe((result[0].startAt.getMonth() + 1) % 12);
  });

  it("stops at UNTIL (inclusive)", () => {
    const result = expandOccurrences(
      {
        ...base,
        rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=2025-01-20T09:00:00Z",
      },
      { windowEndISO },
    );
    // Jan 6, Jan 13, Jan 20 — UNTIL is inclusive
    expect(result).toHaveLength(3);
    expect(result[2].startAt).toEqual(new Date("2025-01-20T09:00:00Z"));
  });

  it("caps at 12-month window", () => {
    const shortWindow = new Date(base.startAt);
    shortWindow.setDate(shortWindow.getDate() + 14);

    const result = expandOccurrences(
      { ...base, rrule: "FREQ=DAILY;INTERVAL=1;COUNT=100" },
      { windowEndISO: shortWindow.toISOString() },
    );
    expect(result.length).toBeLessThanOrEqual(14);
    for (const occ of result) {
      expect(occ.startAt < shortWindow).toBe(true);
    }
  });

  it("applies safety cap of 366 occurrences", () => {
    const result = expandOccurrences(
      { ...base, rrule: "FREQ=DAILY;INTERVAL=1" },
      { windowEndISO: "2030-01-06T09:00:00Z" },
    );
    expect(result).toHaveLength(366);
  });
});
