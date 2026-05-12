# Test Case template

Test cases in [`../06-testing/test-cases-fr.md`](../06-testing/test-cases-fr.md) use the Given/When/Then shape. Every FR must have at least one TC; complex FRs (multiple alt flows + exceptions) typically have 5–8.

ID convention: `TC-<MOD>-<FR_NN>-<NN>` for FR-derived TCs; `TC-NFR-<CAT>-<NN>` for NFR verification; `TC-SEC-<NN>` for security; `TC-PERF-<NN>` for perf.

---

## Template

```
TC-XX-NN-NN — <one-line summary>

Traces to:   <FR-XX-NN | NFR-XX-NN>
Type:        <unit | integration | component | e2e | uat | manual | security>
Automated:   <yes | no>
Tooling:     <Vitest | Playwright | k6 | RAGAS | manual UAT | ...>
Priority:    <Smoke | Critical | High | Medium | Low>

Setup (Given):
  - <preconditions, fixtures, seed data>

Action (When):
  - <single observable action>

Verification (Then):
  - <expected outcome 1>
  - <expected outcome 2>

Cleanup:
  - <fixtures torn down>

Notes: <flakiness hints, environment requirements, manual variations>
```

---

## Worked examples

```
TC-IC-04-01 — Event with no conflicts is published

Traces to:   FR-IC-04
Type:        integration
Automated:   yes
Tooling:     Vitest + Supabase test container
Priority:    Smoke

Given:
  - Logged-in actor has role Teacher with event:create on dept "Curriculum".
  - Room "Bilik 3A" is free between 2026-06-01T08:00 and 2026-06-01T10:00.
  - No event exists in that window.

When:
  - Actor calls events.create({ title: "Math Test", start_at: "2026-06-01T08:00Z", end_at: "2026-06-01T10:00Z", room_id: "3A", dept_id: "Curriculum", priority: "EXAM", audience_ref: "Year-5" }).

Then:
  - Response is { ok: true, data: { event_id: <uuid>, status: "PUBLISHED", conflicts: [] } }.
  - One row exists in events with status="PUBLISHED".
  - One row exists in event_audit with kind="create".
  - One row exists in outbox with kind="event.published".

Cleanup:
  - Truncate test schema.

Notes: smoke gate; runs on every PR.
```

```
TC-IC-04-02 — Hard conflict on room is rejected

Traces to:   FR-IC-04, alt-flow 3a
Type:        integration
Automated:   yes
Priority:    Critical

Given:
  - An event already PUBLISHED in room "3A" between 09:00-10:00 on 2026-06-01.

When:
  - Actor calls events.create with overlapping window in same room.

Then:
  - Response is { ok: false, code: "CONFLICT_HARD", details: [{ kind: "ROOM", event_id: <existing> }] }.
  - No new row is added to events.
  - One audit row with kind="conflict_hard" is written.

Notes: verifies DB exclusion constraint catches the case if the app-layer check is bypassed.
```

```
TC-SEC-05 — RAG never returns forbidden chunks for a parent

Traces to:   NFR-SEC-05, FR-AI-01
Type:        security integration
Automated:   yes
Priority:    Critical

Given:
  - Tenant seeded with 100 chunks: 50 with acl_key="dept:academic" (parent has access), 50 with acl_key="staff-only" (parent does not).
  - 25 hand-crafted queries designed so the most-similar chunk is in the staff-only set.

When:
  - Each query is run by a parent user via /api/rag/ask.

Then:
  - For every query, retrieval_log.chunk_ids contains zero ids whose acl_key is "staff-only".
  - Response includes only citations from "dept:academic" chunks.
  - retrieval_log.refused_reason="LOW_CONFIDENCE" is acceptable for queries where no academic chunk is above τ.

Notes: this test is the cross-tenant red-team gate.
```

---

## Authoring rules

1. One observable action per TC. Multi-step scenarios become e2e (`TC-E2E-NN`).
2. Givens describe state, not other test runs.
3. Then assertions are concrete: row counts, status codes, exact field values where possible.
4. UAT cases (`Type: uat`) need a human-readable script with screenshots in `06-testing/uat-scripts/`.
5. Every TC must be locatable from its FR via `traceability-matrix.md`.
