# P0 Decisions — sign-off document

> Audience: Dr Zatul Alwani Shaffiei (supervisor) + SRIAAWP champion (Mohamad Faiz Azizan / Izzatul Izyan Abd Hamid).
>
> Purpose: every question below was unanswered in [`PP.md`](../PP.md) and [`PS.md`](../PS.md). Until they are answered, the schema, RBAC, RAG pipeline, and UI cannot be drawn.
>
> **Status: 11 of 15 LOCKED on 2026-05-05.** Q4 tentative pending document samples; Q11 / Q12 / Q15 deferred to next scrum.

---

## Schedule + status

| # | Topic | Tier | Status |
|---|---|---|---|
| Q1 | Embedding model + dimension | P0 | **LOCKED** — `gemini-embedding-001` @ 1536-d → ADR-006 |
| Q2 | LLM vendor + cost ownership | P0 | **LOCKED** — `gemini-2.5-flash`, free dev / paid prod → ADR-007 |
| Q3 | RAG audience | P0 | **LOCKED** — Admin + Teacher + Parent → ADR-009 |
| Q4 | Document ACL granularity | P0 | tentative — per-document, confirm against real docs |
| Q5 | PDPA-2010 stance | P0 | **LOCKED** — PDPA-aligned from day 1 → ADR-008 |
| Q6 | Session strategy | P0 | **LOCKED** — DB sessions in Supabase → ADR-003 |
| Q7 | Conflict dimension matrix | P1 | **LOCKED** as recommended |
| Q8 | Visibility taxonomy | P1 | **LOCKED** — `{public, internal, role-list}` → ADR-010 |
| Q9 | Verify-Registration evidence | P1 | **LOCKED** — Student IC + Admin manual approval |
| Q10 | Parent ↔ Student linking | P1 | **LOCKED** — Admin-only, manual + CSV bulk → ADR-011 |
| Q11 | Golden 100 Q&A ownership | P2 | deferred to next scrum |
| Q12 | UAT participants | P2 | deferred to next scrum |
| Q13 | NFR target sign-off | P2 | **LOCKED** — targets in `00-master-plan.md` §11.3 accepted |
| Q14 | Cost budget + paying account | P3 | **LOCKED for FYP** — free tier dev, paid Gemini in production |
| Q15 | Production runbook owner | P3 | deferred to next scrum |

---

## P0 — schema-blocking

### Q1. Embedding model + dimension

**Status: LOCKED 2026-05-05** — `gemini-embedding-001` with `outputDimensionality=1536`. Free Gemini API tier during FYP development; paid tier on production turn-on. See [ADR-006](../00-meta/decision-log.md).

Original options considered:

- [ ] BAAI `bge-m3` (1024-d, multilingual, open-source self-hosted).
- [ ] OpenAI `text-embedding-3-small` (1536-d).
- [x] **Google `gemini-embedding-001` with `outputDimensionality=1536`.** Default 3072; recommended presets 768 / 1536 / 3072 (MRL-trained). Selected for the all-Gemini stack and Malay competence.

### Q2. LLM vendor + cost ownership

**Status: LOCKED 2026-05-05** — `gemini-2.5-flash` (GA). Free tier for FYP1 spike + FYP2 dev (synthetic data only); paid tier for production turn-on with real student data. **Multi-key rotation rejected** (Google ToS). Re-evaluate against Gemini 3.x at production deploy if 3.x has reached GA. See [ADR-007](../00-meta/decision-log.md).

Cost ownership in production:

- [x] **School (SRIAAWP) pays** once production deploy occurs. Rate-limit + cache to keep cost predictable (~MYR 50/mo at ~5,000 RAG queries/month).
- [ ] Supervisor / lab budget.
- [ ] Student personal account.

### Q3. RAG audience

**Status: LOCKED 2026-05-05** — Admin + Teacher + Parent. Student excluded in v1 (PDPA risk on under-13 + LLM interaction). See [ADR-009](../00-meta/decision-log.md).

- [ ] Admin + Teacher only.
- [x] **Admin + Teacher + Parent.** Matches Slide 11 example use case.
- [ ] All four roles incl. Student.

### Q4. Document ACL granularity

**Status: TENTATIVE 2026-05-05** — proceeding with per-document ACL for design work; confirm against real document samples once school provides them.

- [x] **Per-document ACL** — `document.visibility` is one of {public, all-staff, dept, role-list, user-list}; denormalised onto each chunk as `acl_key` for fast pre-filter.
- [ ] Per-folder/department ACL — every doc inherits its dept's ACL; can override per-doc.
- [ ] Per-chunk ACL — most flexible, most expensive. Not chosen for v1.

### Q5. PDPA-2010 + minor consent stance

**Status: LOCKED 2026-05-05** — PDPA-aligned design from day 1. See [ADR-008](../00-meta/decision-log.md).

Implementation includes Privacy Notice in BM and EN, parental consent template for under-13, IC numbers column-encrypted at rest, audit log on every student-data access, DSAR (data subject access request) endpoint, designated DPO on the Privacy Notice, breach notification ≤ 72 h runbook. Production turn-on with real data is gated on signed parental consents + paid Gemini tier + signed Surat Kebenaran from school principal.

- [x] **Prepare full PDPA-aligned design now**, even if FYP1/2 data is synthetic.
- [ ] Defer PDPA design to post-FYP. (Rejected — examiner risk + school will refuse production turn-on.)

### Q6. Session strategy

**Status: LOCKED 2026-05-05** — database sessions in Supabase. See [ADR-003](../00-meta/decision-log.md).

- [x] **Database sessions in Supabase** — instant permission revocation when a teacher leaves the school.
- [ ] JWT sessions.

---

## P1 — UI-blocking

### Q7. Conflict dimension matrix

**Status: LOCKED 2026-05-05** as recommended:

| Dimension | Hard | Soft | Notes |
|---|:---:|:---:|---|
| Same room, time overlap | x | | DB exclusion constraint |
| Same organizer, time overlap | | x | warn — teacher may double-book themselves |
| Same audience (cohort), time overlap | | x | except `priority=EXAM` |
| Same audience (cohort), `priority=EXAM` | x | | exam clashes are catastrophic |
| Same dept, dept blackout window | | x | warn |
| School-wide blackout (Hari Raya, exam week, Friday prayer 12:30–14:30) | x | | override available to Admin only with reason |

### Q8. Visibility taxonomy

**Status: LOCKED 2026-05-05** — `{public, internal, role-list}`. See [ADR-010](../00-meta/decision-log.md).

- [x] **Simpler `{public, internal, role-list}`.** Department-level scoping handled via department-coded role codes (e.g. `teacher_curriculum`) inside the role-list rather than a separate `dept_id` column.
- [ ] Richer 5-way `{public, authenticated, role:role_id, dept:dept_id, audience:audience_ref}`.

### Q9. Verify-Registration evidence

**Status: LOCKED 2026-05-05** — Student IC + Admin manual approval.

- [ ] Student IC alone — too weak.
- [x] **Student IC + Admin manual approval.**
- [ ] One-time enrolment token issued by school office.
- [ ] Parent's identity card photo upload + admin review.

### Q10. Parent ↔ Student linking

**Status: LOCKED 2026-05-05** — Admin-only creation; tool supports both single manual entry and bulk CSV import at start of school year. Parents cannot self-link. Parents **cannot** view their student's AI chat history. See [ADR-011](../00-meta/decision-log.md).

- [x] **Admin creates the link manually** from school records.
- [ ] Parent self-claims by entering Student IC + token.
- [x] **Bulk CSV import at start of school year** + per-family edits afterwards.

Parent visibility into Student's AI chat history:

- [x] **No** (recommended; locked).
- [ ] Yes.
- [ ] Conditional — only achievement-related chats.

---

## P2 — test-plan-blocking

### Q11. Golden 100 Q&A ownership

**Status: DEFERRED to next scrum.**

Pre-meeting recommendation (for reference): School champion provides 50 real parent FAQs + 25 teacher Qs + 25 admin Qs; student writes ground-truth answers from documents. Final ownership and timeline to be confirmed in scrum.

### Q12. UAT participants

**Status: DEFERRED to next scrum.**

Pre-meeting recommendation: 5 Admin + 10 Teachers + 10 Parents + 5 Students = 30 (UEQ benchmark minimum). Recruitment plan, incentives, and scheduling to be confirmed in scrum.

### Q13. NFR target sign-off

**Status: LOCKED 2026-05-05** — targets in [`../00-master-plan.md`](../00-master-plan.md) §11.3 accepted as written (uptime 99.5%, RPO 24h / RTO 4h, p95 RAG TTFT ≤ 2 s, p95 conflict check ≤ 500 ms, etc.).

---

## P3 — operational

### Q14. Cost budget + paying account

**Status: LOCKED for FYP duration 2026-05-05** — free tier where possible during development:

- Gemini API: free tier (1,500 req/day, 1M TPM); single API key (no rotation — Google ToS).
- Supabase: free tier.
- Vercel: free / hobby tier.

Switch to paid Gemini tier for production turn-on with real student data (PDPA opt-out of training). Re-evaluate Vercel / Supabase tiers at deploy time. School assumes cost from production turn-on. Estimated production budget ≤ MYR 100/mo.

### Q15. Production runbook owner at SRIAAWP

**Status: DEFERRED to next scrum.**

Need: name, email, phone of the person at SRIAAWP who is the on-call contact when the site is broken in production. To be discussed with school champion in next scrum.

---

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Student | Muhammad Arif Hakimi | 2026-05-05 | (electronic — see commit history) |
| Supervisor | Dr Zatul Alwani Shaffiei | | |
| School champion | Mohamad Faiz Azizan / Izzatul Izyan | | |

After supervisor + school countersignature, every "LOCKED" answer is referenced from its corresponding ADR in [`../00-meta/decision-log.md`](../00-meta/decision-log.md). Future revisits supersede the ADR rather than overwrite this document.
