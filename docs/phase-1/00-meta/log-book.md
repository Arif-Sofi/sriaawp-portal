# PSM1 Log Book

> Weekly meeting log for UTM PSM1 (SECx 3032). Append-only. Each entry is countersigned by the supervisor at the next weekly meeting. Target: at least 10 countersigned entries by PSM1 close (per [Master plan §2.1](../00-master-plan.md)).
>
> **Format.** One H2 per entry (`## YYYY-MM-DD — <topic>`), with the fields below. Hand-written equivalent lives in the physical UTM PSM1 log book; this file is the digital twin.

---

## Entry template

```
## YYYY-MM-DD — <topic>

- **Attendees.** <list>
- **Agenda.**
  1. <item>
  2. <item>
- **Decisions.**
  - <decision> (link to ADR if applicable)
- **Actions.**
  - [ ] <owner> — <action> — due <date>
- **Next meeting.** <date / time>
- **Evidence.** <link to minutes / screenshot under docs/phase-1/source/meetings/...>
```

---

## 2026-05-05 — P0 decisions lock-in

- **Attendees.** Muhammad Arif Hakimi (author); Dr Zatul Alwani Binti Shaffiei (supervisor; remote review).
- **Agenda.**
  1. Walk through the 15 P0/P1/P2/P3 decisions from [`../01-overview/p0-decisions-to-lock.md`](../01-overview/p0-decisions-to-lock.md).
  2. Lock embedding model + LLM vendor + cost ownership.
  3. Lock PDPA-2010 stance and parental-consent design intent.
  4. Lock conflict-dimension matrix and visibility taxonomy.
  5. Confirm route-group + auth model from the Foundation spike (Next.js 16 + Auth.js v5).
- **Decisions.**
  - Q1 — Embedding `gemini-embedding-001` @ 1536-d ([ADR-006](./decision-log.md)).
  - Q2 — LLM `gemini-2.5-flash`, free dev / paid prod, single key ([ADR-007](./decision-log.md)).
  - Q3 — RAG audience Admin + Teacher + Parent ([ADR-009](./decision-log.md)).
  - Q5 — PDPA-aligned design from day 1 ([ADR-008](./decision-log.md)).
  - Q6 — DB sessions, not JWT ([ADR-003](./decision-log.md)).
  - Q7 — Conflict-dimension matrix as recommended (HARD/SOFT split per [Master plan §11.6](../00-master-plan.md)).
  - Q8 — Visibility `{public, internal, role-list}` ([ADR-010](./decision-log.md)).
  - Q9 — Verify-Registration via Student IC + Admin manual approval.
  - Q10 — Parent ↔ Student linking Admin-only, manual + CSV bulk ([ADR-011](./decision-log.md)).
  - Q13 — NFR targets in [Master plan §11.3](../00-master-plan.md) accepted.
  - Q14 — Cost budget locked for FYP (free tier dev, paid Gemini in production).
- **Actions.**
  - [ ] Author — open Foundation PR (#22) + WS-A meta PR (this stack) — due 2026-05-05.
  - [ ] Author — chase *Surat Kebenaran* draft to school champion — due 2026-05-12.
  - [ ] Author — schedule first in-person meeting with school champion (Faiz / Izyan) — due 2026-05-19.
  - [ ] Author — book Round-1 stakeholder interview slots before Hari Raya — due 2026-05-19.
- **Next meeting.** 2026-05-12 (Monday), 30 min, Google Meet — review Foundation + WS-A PRs after merge; begin requirements engineering kick-off (interview guide draft).
- **Evidence.** P0 decisions locked in [`../01-overview/p0-decisions-to-lock.md`](../01-overview/p0-decisions-to-lock.md); ADRs ADR-001 through ADR-011 already on disk; spike reports under [`../05-tech-spikes/`](../05-tech-spikes/).

## 2026-06-20 — Stakeholder re-baseline (four change requests)

- **Attendees.** Muhammad Arif Hakimi (author); Puan Izzah (SRIAAWP school champion). Supervisor not present — changes carried to the next weekly meeting for ratification.
- **Agenda.**
  1. Confirm authentication approach against the SRS and thesis.
  2. Finalise the AI assistant design (RAG vs agentic).
  3. Discuss Facebook Page integration request.
  4. Discuss parent–teacher interaction on news items.
- **Decisions (requested by the school; recorded as Proposed pending supervisor sign-off).**
  - **C1 — Authentication.** Use Supabase native Auth instead of Auth.js. This realigns with the SRS (UC01 "Login with Google"; Design Constraints "uses Supabase to hash and secure") and the thesis (Ch3 Supabase Auth + RLS; Ch4 ERD "PROFILES connected to Supabase Auth's auth_users"). Reopens P0-Q6. See [ADR-018](./decision-log.md), [ADR-019](./decision-log.md).
  - **C2 — AI assistant.** Agentic assistant with three grounded modes: (1) in-article context-stuffing, (2) `get_news` function-calling over caller-visible news, (3) true RAG over a how-to-use-the-system manual (not yet authored) with image-link return. Only mode 3 is RAG. Re-scopes the document-RAG design; reopens P0-Q3/Q4. See [ADR-020](./decision-log.md).
  - **C3 — Facebook Page sync.** School wants portal news mirrored to its Facebook Page and Facebook posts pulled into the portal. Recorded as a request to scope; full bidirectional sync is not committed. See [ADR-022](./decision-log.md).
  - **C4 — News engagement.** News items should support likes and parent-question / teacher-answer comment threads, replacing the current Telegram Q&A loop (thesis §Problem Background). See [ADR-021](./decision-log.md).
- **Actions.**
  - [ ] Author — issue P0 v2 reopening Q3/Q4/Q6 and adding sign-off rows for C3 (Facebook scope + credential ownership) and C4 (engagement + minor-UGC moderation) — due 2026-06-23.
  - [ ] Author — write ADR-018..023 and the revised MoSCoW baseline — due 2026-06-23.
  - [ ] Author — present the re-baseline to Dr Zatul at the next weekly meeting and obtain the supervisor + Pengetua countersignature outstanding on the original P0 — due next weekly.
  - [ ] Author — confirm with the school who owns the Meta app + Page-admin grant (blocks any Facebook work) — due next bi-weekly.
  - [ ] Author — confirm who authors the how-to manual and in what format (blocks AI mode 3) — due next bi-weekly.
- **Next meeting.** Next weekly supervisor meeting — ratify the re-baseline and re-sign P0 v2.
- **Evidence.** SRS + thesis mirrors synced 2026-06-20 under [`../../source-docs/`](../../source-docs/); change analysis recorded in [ADR-018..023](./decision-log.md) and [`../01-overview/p0-decisions-to-lock.md`](../01-overview/p0-decisions-to-lock.md) v2.
