# Functional Requirement template

Use this 7-field template for every FR in [`../02-requirements/functional-requirements.md`](../02-requirements/functional-requirements.md). Module prefixes:

| Prefix | Module |
|---|---|
| `FR-UM-NN` | User Management |
| `FR-DM-NN` | Department / Document Management |
| `FR-IC-NN` | Information Center (events / news / memos / Takwim / report) |
| `FR-CR-NN` | Co-curricular Record |
| `FR-AI-NN` | AI / RAG subsystem |

Numbering is sequential within each module, never reused after deprecation.

---

## Template

```
FR-XX-NN — <short imperative title>

Actor(s):       <Admin | Teacher/Staff | Parent | Student | Anonymous (any subset)>
Priority:       <Must | Should | Could | Won't> (MoSCoW)
Source:         <PP §X | PS slide N | interview-YYYY-MM-DD-<persona> | derived>
Description:    <one sentence — what the system does and why>

Preconditions:
  - <state required before this FR can run>

Main flow:
  1. <actor action>
  2. <system response>
  3. ...

Alternate flows:
  Na) <branching condition>
       i.   ...
       ii.  ...

Postconditions:
  - <state guaranteed after success>

Exceptions:
  E-01 <error condition> -> <result code / behavior>
  E-02 ...

NFR refs: <NFR-PERF-NN, NFR-SEC-NN, ...>
Linked use case(s): <UC-NN>
Linked test case(s): <TC-NN>
Linked screen(s):    <screens/<id>.md>
Open questions:      <pending P0 / P1 decision references>
```

---

## Worked example (the canonical sample)

```
FR-IC-04 — Schedule Conflict Check

Actor(s):       Teacher, Admin
Priority:       Must
Source:         PS Slide 10 + interview-YYYY-MM-DD-faiz
Description:    System detects scheduling conflicts before an event is persisted as PUBLISHED, classifying each conflict as HARD (blocking) or SOFT (warning).

Preconditions:
  - Actor authenticated; has event:create on target dept.
  - Event has start_at, end_at, room_id?, organizer_id, audience_ref, priority.
  - end_at > start_at.

Main flow:
  1. Actor submits draft event.
  2. System runs detectConflicts(event) (see ../03-design/conflict-checker-design.md).
  3. If [] returned, persist as PUBLISHED, return 201 with event id and empty conflicts.

Alternate flows:
  3a) Hard conflicts present
       i.   Reject; do not persist.
       ii.  Return 409 CONFLICT_HARD with list of conflicting event ids.
  3b) Only soft conflicts present
       i.   Persist as PENDING_REVIEW.
       ii.  Return 202 CONFLICT_SOFT with list of conflicts.
       iii. Admin override required to publish; reason text stored.

Postconditions:
  - Audit row written to event_audit (kind = create | conflict_soft | conflict_hard).
  - If PUBLISHED, outbox row created for Takwim cache invalidation.

Exceptions:
  E-01 invalid range (end_at <= start_at)            -> 422 VALIDATION
  E-02 audience_ref refers to deleted department     -> 422 VALIDATION
  E-03 detection timeout > 500 ms                    -> 503 INTERNAL (fail-closed)
  E-04 actor lacks event:create on dept              -> 403 FORBIDDEN

NFR refs:           NFR-PERF-02 (p95 < 500 ms), NFR-SEC-03 (server-side RBAC), NFR-OPS-02 (audit retention 1 y)
Linked use case(s): UC-IC-CreateEvent, UC-IC-CheckConflict
Linked test case(s): TC-IC-04-01 (no conflict), TC-IC-04-02 (room hard), TC-IC-04-03 (audience exam hard), TC-IC-04-04 (organizer soft), TC-IC-04-05 (timeout fail-closed)
Linked screen(s):    wireframes/event-create.md
Open questions:      P1-Q7 (conflict matrix sign-off)
```

---

## Authoring rules

1. **One FR per atomic, observable behaviour.** "User can manage events" is not an FR — it's an epic. Split into create / edit / cancel / publish / override.
2. **MoSCoW honestly.** Most FRs should be Must or Should. Could/Won't bins protect against scope creep.
3. **Source must be cited.** Every FR traces to a PP/PS line, an interview note, or another FR. No "intuited" requirements.
4. **Pre and Post are checkable assertions**, not goals.
5. **Exceptions enumerate user-visible failures**, with the API status code or screen-error code that the user sees.
6. **NFR refs are a checklist for the test author** — every linked NFR must have a test case verifying the FR meets it.
7. **Open questions section blocks sign-off** — an FR with open P0 / P1 references is not Accepted.
