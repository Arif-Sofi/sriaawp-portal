# Stakeholder Communication Plan

> Cadence, channels, and evidence-of-record rules for every stakeholder listed in [`stakeholder-register.md`](./stakeholder-register.md). The plan exists so that, on examiner day, every claim of "we agreed X with the school on Y date" is backed by a log-book row and a captured artefact.
>
> Scope: PSM1 (Weeks 1–14). Re-baselined at the start of PSM2.

---

## 1. Cadence

| Stakeholder | Frequency | Default slot | Format |
|---|---|---|---|
| Supervisor (Dr Zatul Alwani) | **Weekly** | Mondays (slot agreed each week via email; default 30–60 min) | Google Meet or in-person at MJIIT |
| SRIAAWP school champion (Faiz / Izyan) | **Bi-weekly** | Slot agreed per fortnight; aligned with school timetable | Google Meet for short check-ins; in-person at SRIAAWP for interviews + document walkthroughs |
| SRIAAWP — Pengetua | **Ad-hoc** at sign-off gates G1, G3, G5 | Scheduled ≥ 2 weeks ahead | In-person at SRIAAWP |
| End-user UAT cohort (Admin / Teacher / Parent / Student) | **One UAT round** in PSM2 Weeks 11–12 | TBD | On-site sessions; UEQ + SUS forms |
| UTM PSM1 examiner panel | **One defense session** at PSM1 close | UTM-scheduled | In-person, 20 min present + 10 min Q&A |

**No-show fallback.** If a slot is missed, the next slot is non-negotiable; the missed agenda items roll into the next agenda. Three consecutive missed weekly meetings with the supervisor is escalated to the FoC PSM coordinator.

---

## 2. Channels

| Channel | Use for | Not for |
|---|---|---|
| Email | Formal sign-off, schedule changes, attaching artefacts for review | Day-to-day questions |
| Google Meet | All recurring meetings | Long-form deliverables (use email + Git) |
| WhatsApp (school champion only) | Short-cycle clarifications during the elicitation rounds | Anything that needs to be signed or audited |
| Git repo (Arif-Sofi/sriaawp-portal) | Living artefacts; reviewers comment on PRs | Personal data (no real student PII in the repo) |
| UTM PSM1 log book | Countersigned weekly meeting record | Discussion content (use minutes for that) |

---

## 3. Evidence captured

Every stakeholder interaction produces **two** artefacts and **never zero**:

1. **Meeting minutes** — appended to [`log-book.md`](./log-book.md) with date, attendees, agenda, decisions, actions, next meeting. One row per meeting.
2. **Screenshot or photo** — Google Meet roster screenshot for remote meetings; photo of in-person setup with consent. Filed under `docs/phase-1/source/meetings/<YYYY-MM-DD>-<topic>.png` (folder created on first meeting that produces one).

If a decision was made, **a third artefact**: a new ADR row in [`decision-log.md`](./decision-log.md) referencing the meeting date.

**Privacy.** Screenshots that include parents or students are blurred / cropped before commit. Real names of minors never enter the repo.

---

## 4. Sign-off gates

The five sign-off gates from [Master plan §9](../00-master-plan.md) drive the cadence above. Each gate produces a signed artefact (digital or wet-ink).

| Gate | Target week | Signers | Signed artefact |
|---|---|---|---|
| **G1 — Charter & P0 decisions** | Week 3 | Supervisor + Pengetua | [`../01-overview/p0-decisions-to-lock.md`](../01-overview/p0-decisions-to-lock.md) (already locked 2026-05-05) + signed *Surat Kebenaran* |
| **G2 — Requirements freeze** | Week 7 | Supervisor (sign-off authority); school champion (review only) | FR catalogue, NFR table, RBAC matrix, use-case spec, RTM stub |
| **G3 — Design freeze** | Week 11 | Supervisor + Pengetua (where school-impacting) | Architecture, ERD, schema, API spec, RAG pipeline, conflict spec, wireframes |
| **G4 — Test plan + thesis draft** | Week 13 | Supervisor | Test strategy, UAT/UEQ instruments, Ch 1–4 drafts |
| **G5 — Defense ready** | Week 14 | Supervisor + UTM PSM1 panel | Defense slides, poster, all UTM forms, log book, FYP2 sprint plan |

**Definition of "signed".** Supervisor: email reply with explicit "Approved" on the artefact at a pinned commit hash, OR wet-ink signature on a printed copy filed under `docs/phase-1/source/signoffs/`. School: wet-ink on the *Surat Kebenaran* and on the relevant evaluation forms.

**Reopening a gate.** Any change to a signed artefact triggers (a) a new ADR, (b) re-sign at the next regular meeting. Old signatures are not invalidated retroactively but the new state is the active one.

---

## 5. Escalation

In order:

1. Author flags the issue to supervisor at the next weekly meeting.
2. Supervisor + author decide whether to escalate to school champion / Pengetua.
3. If unresolved within 2 weekly cycles, escalate to FoC PSM coordinator.
4. If a P0 decision is in dispute, the [P0 decisions document](../01-overview/p0-decisions-to-lock.md) stays at the previously locked answer until a new ADR supersedes it.

---

## 6. Open communications questions

- Confirm preferred WhatsApp / email split with school champion at first in-person meeting.
- Confirm whether SRIAAWP wants meeting minutes shared in BM, EN, or both. Default for now: EN, with BM glossary terms where relevant.
- Confirm Pengetua's preferred channel for the *Surat Kebenaran* (digital signature platform vs printed letter).
