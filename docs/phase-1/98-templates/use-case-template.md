# Use Case template (Cockburn fully-dressed)

Use this template for every use case identified in [`../PS.md`](../PS.md) Slide 26 and any new ones surfaced during interviews. File: [`../02-requirements/use-case-spec.md`](../02-requirements/use-case-spec.md), one section per use case.

---

## Template

```
UC-XX-NN — <Verb-noun title (matches the bubble in the use case diagram)>

Scope:           <System under design = SRIAAWP Portal>
Level:           <Summary | User-goal | Subfunction>
Primary actor:   <single role>
Stakeholders & interests:
  - <stakeholder>: <what they want from this UC>
Preconditions:
  - <facts that must be true before the UC starts>
Trigger:         <what kicks off the UC>
Postconditions:
  Minimal guarantees: <true even if UC fails>
  Success guarantees: <true if UC succeeds>

Main success scenario:
  1. <actor action>
  2. <system response>
  3. ...

Extensions:
  Na. <condition>:
       Na1. <step>
       Na2. <step>

Special requirements:
  - <UI / performance / security constraints relevant to this UC>

Technology and data variations list:
  Na. <variation>:
       <how it's handled>

Frequency of occurrence: <e.g. ~30/day per teacher>
Open issues: <P0 / P1 references>
Related FRs: <FR-XX-NN, ...>
```

---

## Worked example

```
UC-IC-CreateEvent — Create Event

Scope:           SRIAAWP Portal
Level:           User-goal
Primary actor:   Teacher (also: Admin)
Stakeholders & interests:
  - School: events do not collide with exams or Friday prayer.
  - Parents: published events appear on the public Takwim within 60 s.
  - Teacher: creating an event takes < 60 s of clicks.
Preconditions:
  - Actor signed in with role Teacher or Admin.
  - Actor has event:create permission on the chosen department.
Trigger: Actor clicks "Create event" on the Takwim screen.
Postconditions:
  Minimal guarantee: no row written if any hard conflict OR validation error.
  Success guarantee: event row exists in events with status PUBLISHED or PENDING_REVIEW; audit row written; if PUBLISHED, outbox row queued.

Main success scenario:
  1. Actor opens event-create form.
  2. System pre-fills organizer_id with actor; loads dept list (filtered by actor's permissions); loads room list; loads audience picker.
  3. Actor enters title, body, start_at, end_at, room (optional), audience, visibility, priority, recurrence (optional).
  4. Actor clicks Save.
  5. System runs detectConflicts(event); returns [].
  6. System persists event as PUBLISHED.
  7. System writes audit row and outbox row.
  8. UI shows success toast and navigates to Takwim showing the new event.

Extensions:
  5a. Hard conflicts returned:
       5a1. UI opens ConflictModal listing blocks grouped by kind (room, blackout, exam-audience).
       5a2. Actor can Edit (return to form) or Cancel.
       5a3. UC ends without persistence.
  5b. Only soft conflicts returned:
       5b1. UI opens ConflictModal with "Save anyway as Pending Review" CTA.
       5b2. If Save clicked, persist as PENDING_REVIEW; return 202.
       5b3. Send notification to dept admin for review.
  5c. Admin actor with event:override_conflict permission:
       5c1. Override CTA visible; reason textarea required.
       5c2. Persist as PUBLISHED; reason stored on audit row.

Special requirements:
  - p95 conflict-check < 500 ms (NFR-PERF-02).
  - Form is fully usable on mobile (NFR-ENV-02).
  - Recurrence builder supports RRULE FREQ=DAILY|WEEKLY|MONTHLY|YEARLY with COUNT or UNTIL.

Technology and data variations:
  3a. Event imported from ICS/CSV (UC-IC-ImportEvent): same validations apply but actor is a bulk import job.

Frequency of occurrence: peak ~10/day school-wide; ~30/week per active teacher.
Open issues: P1-Q7 (final hard/soft matrix sign-off).
Related FRs: FR-IC-01 (Create Event), FR-IC-04 (Schedule Conflict Check), FR-IC-08 (Generate Report).
```

---

## Authoring rules

1. Use case name = verb + noun, present tense, business language.
2. Primary actor is **one** role; if more than one, write separate use cases or document the variation in the *Technology and data variations* list.
3. Preconditions are about state, not user behaviour.
4. The main success scenario is the happy path. Branches go in *Extensions*, numbered to match the step they branch from.
5. Special requirements should reference NFR IDs.
6. Frequency of occurrence drives load testing assumptions; estimate even if rough.
7. Sign-off requires every related FR to be Accepted.
