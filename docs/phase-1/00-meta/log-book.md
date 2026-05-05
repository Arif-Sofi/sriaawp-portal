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
