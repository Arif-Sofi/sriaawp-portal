export type RecurrenceRule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  count?: number;
  untilISO?: string;
};

export function serializeRrule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq}`, `INTERVAL=${rule.interval}`];
  if (rule.count !== undefined) parts.push(`COUNT=${rule.count}`);
  if (rule.untilISO) parts.push(`UNTIL=${rule.untilISO}`);
  return parts.join(";");
}

export function parseRrule(s: string | null): RecurrenceRule | null {
  if (!s) return null;

  const map: Record<string, string> = {};
  for (const part of s.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    map[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
  }

  const freq = map["FREQ"];
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") return null;

  const interval = map["INTERVAL"] ? parseInt(map["INTERVAL"], 10) : 1;
  if (isNaN(interval) || interval < 1) return null;

  const rule: RecurrenceRule = { freq, interval };
  if (map["COUNT"]) {
    const count = parseInt(map["COUNT"], 10);
    if (!isNaN(count)) rule.count = count;
  }
  if (map["UNTIL"]) rule.untilISO = map["UNTIL"];

  return rule;
}

type BaseEvent = { startAt: Date; endAt: Date; rrule: string | null };
type ExpandOptions = { windowEndISO: string };

const SAFETY_CAP = 366;

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function expandOccurrences(
  base: BaseEvent,
  { windowEndISO }: ExpandOptions,
): { startAt: Date; endAt: Date }[] {
  const rule = parseRrule(base.rrule);
  if (!rule) return [{ startAt: base.startAt, endAt: base.endAt }];

  const durationMs = base.endAt.getTime() - base.startAt.getTime();
  const hardWindowEnd = new Date(windowEndISO);
  const untilDate = rule.untilISO ? new Date(rule.untilISO) : null;

  const occurrences: { startAt: Date; endAt: Date }[] = [];
  let current = base.startAt;

  while (occurrences.length < SAFETY_CAP) {
    if (current >= hardWindowEnd) break;
    if (untilDate && current > untilDate) break;
    if (rule.count !== undefined && occurrences.length >= rule.count) break;

    occurrences.push({ startAt: current, endAt: new Date(current.getTime() + durationMs) });

    if (rule.freq === "DAILY") {
      current = addDays(current, rule.interval);
    } else if (rule.freq === "WEEKLY") {
      current = addDays(current, 7 * rule.interval);
    } else {
      current = addMonths(current, rule.interval);
    }
  }

  return occurrences;
}
