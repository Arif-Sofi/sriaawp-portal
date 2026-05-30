# Conflict Checker Design

This document describes the scheduling conflict detection algorithm implemented in PR5 (`feat/events-conflict`), as specified in master-plan section 11.6.

## 1. Overview

When a staff member creates an event, the system must detect whether that event collides with existing published events or blackout windows. Conflicts are classified by kind and severity (hard or soft). The outcome of creation depends on whether hard conflicts are present, whether the actor holds the override permission, and whether an override reason was provided.

## 2. Occurrence Expansion

Events may recur. Before conflict detection can run, the candidate event must be expanded into a set of concrete date-time ranges (occurrences).

### 2.1 RRULE serialisation format

The `rrule` field on the `event` table stores a simplified subset of the iCalendar RRULE format:

```
FREQ=<DAILY|WEEKLY|MONTHLY>;INTERVAL=<n>[;COUNT=<n>][;UNTIL=<ISO8601>]
```

Only these four keys are supported. The `serializeRrule` and `parseRrule` functions in `src/lib/conflict/rrule.ts` perform lossless round-trips on this format.

### 2.2 Expansion algorithm

`expandOccurrences(base, { windowEndISO })` expands a base event into its occurrences:

```
Input: base { startAt, endAt, rrule }, windowEndISO
Output: [{ startAt, endAt }]

durationMs = base.endAt - base.startAt
hardWindowEnd = new Date(windowEndISO)

if rrule is null:
  return [{ startAt: base.startAt, endAt: base.endAt }]

parse rrule -> { freq, interval, count?, untilISO? }

occurrences = []
current = base.startAt

while occurrences.length < 366:
  if current >= hardWindowEnd: break
  if untilDate and current > untilDate: break
  if count defined and occurrences.length >= count: break

  append { startAt: current, endAt: current + durationMs }

  advance current:
    DAILY   -> +interval days
    WEEKLY  -> +7*interval days
    MONTHLY -> +interval calendar months
```

Three stopping conditions apply (the first reached wins): `count`, `untilISO`, and the 12-month window cap (`windowEndISO`). A hard safety cap of 366 occurrences prevents runaway loops regardless of RRULE content.

The `UNTIL` boundary is inclusive: an occurrence starting exactly at `untilISO` is included.

## 3. Conflict Classification

`classifyConflicts` in `src/lib/conflict/classify.ts` is a pure function. It receives the candidate descriptor, its expanded occurrences, a list of already-filtered published other-events, and blackout windows. It returns zero or more `ConflictBlock` records.

### 3.1 Overlap predicate

Two time ranges `[aStart, aEnd)` and `[bStart, bEnd)` overlap if and only if:

```
aStart < bEnd AND bStart < aEnd
```

### 3.2 Hard/soft matrix

| Kind              | Hard condition                                                  | Soft condition                    |
|-------------------|-----------------------------------------------------------------|-----------------------------------|
| `BLACKOUT_SCHOOL` | Always hard                                                     | —                                 |
| `BLACKOUT_DEPT`   | —                                                               | Always soft                       |
| `ROOM`            | Always hard (two events cannot physically share a room)         | —                                 |
| `ORGANIZER`       | —                                                               | Always soft                       |
| `AUDIENCE`        | Hard when candidate or conflicting event has `priority = exam`  | Soft when both are `normal`       |

### 3.3 Classification rules

For each kind, the algorithm inspects all candidate occurrences against all other-event occurrences:

**BLACKOUT_SCHOOL**: any school-scoped blackout window overlaps any candidate occurrence.

**BLACKOUT_DEPT**: any department-scoped blackout window whose `deptId` matches `candidate.deptId` overlaps any candidate occurrence.

**ROOM**: `candidate.roomId` is non-null AND an other-event with the same `roomId` has an overlapping occurrence.

**ORGANIZER**: `candidate.organizerUserId` is non-null AND an other-event with the same `organizerUserId` has an overlapping occurrence.

**AUDIENCE**: an other-event has at least one overlapping occurrence AND its `audiences` share at least one non-public entry with the candidate's `audienceRefs` (role-to-role match or department-to-department match on the `ref` field). Public audiences are excluded from this comparison to avoid universal conflicts.

Each kind produces at most one `ConflictBlock`. The `conflictingEventIds` array is deduplicated.

### 3.4 Pseudocode

```
classifyConflicts({ candidate, candidateOccurrences, otherEvents, blackouts }):
  blocks = []

  if any school blackout overlaps any candidateOccurrence:
    push BLACKOUT_SCHOOL (hard=true)

  if candidate.deptId and any dept blackout for that dept overlaps any candidateOccurrence:
    push BLACKOUT_DEPT (hard=false)

  if candidate.roomId:
    ids = [other.id for other in otherEvents where
             other.roomId == candidate.roomId and
             any occurrence of other overlaps any candidateOccurrence]
    if ids not empty: push ROOM (hard=true, ids=dedup(ids))

  if candidate.organizerUserId:
    ids = [other.id for other in otherEvents where
             other.organizerUserId == candidate.organizerUserId and
             any occurrence of other overlaps any candidateOccurrence]
    if ids not empty: push ORGANIZER (hard=false, ids=dedup(ids))

  nonPublicAudiences = [a for a in candidate.audienceRefs where a.type != 'public']
  if nonPublicAudiences not empty:
    ids = [other.id for other in otherEvents where
             any occurrence overlaps and
             other.audiences intersects nonPublicAudiences (matching type and ref)]
    if ids not empty:
      hard = candidate.priority == 'exam' or any matched other has priority == 'exam'
      push AUDIENCE (hard=hard, ids=dedup(ids))

  return blocks
```

## 4. Event Creation Flow

`createEvent` in `src/app/actions/events.ts` orchestrates detection and persistence. The function is a Server Action guarded by `requirePermission('event:create')`.

### 4.1 Decision matrix

After running `detectConflicts` inside a Drizzle transaction:

| Condition                                                         | Persistence            | Audit                              | Outcome            |
|-------------------------------------------------------------------|------------------------|------------------------------------|-------------------|
| No blocks                                                         | `status = published`   | `event.create`                     | `PUBLISHED`        |
| Soft blocks only                                                  | `status = pending_review` | `event.create`                  | `PENDING_REVIEW`   |
| Hard blocks, no override provided                                 | None                   | None                               | `BLOCKED_HARD`     |
| Hard blocks, override provided, caller has `event:override_conflict` | `status = pending_review` | `event.create`, `event.override` | `PENDING_REVIEW` |
| Hard blocks, override provided, caller lacks the permission       | None (fail)            | None                               | Permission error   |

When the outcome is `BLOCKED_HARD`, the action returns `ok({ eventId: null, blocks, outcome: 'BLOCKED_HARD' })` — the `ok` wrapper is intentional so the client receives the `blocks` array to display the conflict modal, while `outcome` distinguishes it from a real success.

### 4.2 Persistence

On any persisting outcome, three writes occur in the same transaction:

1. Insert the `event` row with the resolved `status`.
2. Bulk-insert all expanded `event_occurrence` rows.
3. Bulk-insert all `event_audience` rows.

### 4.3 DB-layer detection

`detectConflicts` in `src/lib/conflict/index.ts` queries only the window `[minOccurrenceStart, maxOccurrenceEnd]` to bound the lookup:

- Fetch published events (excluding `candidate.eventId`) whose occurrences overlap the window, with their occurrences and audiences.
- Fetch blackout windows overlapping the window.

All queries use Drizzle bound parameters. No string interpolation is used.

## 5. References

- Master-plan section 11.6: conflict checker specification.
- `src/lib/conflict/rrule.ts`: RRULE serialisation, parsing, expansion.
- `src/lib/conflict/classify.ts`: pure conflict classification.
- `src/lib/conflict/index.ts`: DB-layer detection.
- `src/app/actions/events.ts`: Server Action integrating detection and persistence.
- `docs/phase-1/00-meta/decision-log.md`: ADR-017 auth and session design (session user shape).
