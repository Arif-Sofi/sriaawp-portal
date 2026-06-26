# P0 Decisions — sign-off document

> Audience: Dr Zatul Alwani Shaffiei (supervisor) + SRIAAWP champion (Mohamad Faiz Azizan / Izzatul Izyan Abd Hamid).
>
> Purpose: every question below was unanswered in [`PP.md`](../PP.md) and [`PS.md`](../PS.md). Until they are answered, the schema, RBAC, RAG pipeline, and UI cannot be drawn.
>
> **Status: v2 (2026-06-21 re-baseline).** v1 locked 11 of 15 on 2026-05-05. The 2026-06-20 stakeholder re-baseline (ADR-018/019 already applied; ADR-020/021/022 pending) **reopened Q3 (RAG audience), Q4 (document ACL), and Q6 (session strategy)** and **added Q16-Q19**. Q1/Q2/Q5/Q7-Q15 carry forward unchanged from v1.
>
> v1 was **student-signed only** — the supervisor and Pengetua (school principal) countersignature rows were never filled, and the Surat Kebenaran is still pending. Because no countersigned baseline exists, reopening these questions is procedurally clean rather than a breach of a sealed sign-off. **v2 requires supervisor + Pengetua countersignature** before any reopened answer is treated as locked.

---

## Schedule + status

| # | Topic | Tier | Status |
|---|---|---|---|
| Q1 | Embedding model + dimension | P0 | **LOCKED** — `gemini-embedding-001` @ 1536-d → ADR-006 |
| Q2 | LLM vendor + cost ownership | P0 | **LOCKED** — `gemini-2.5-flash`, free dev / paid prod → ADR-007 |
| Q3 | RAG audience | P0 | **REOPENED 2026-06-20** — re-scoped to per-mode audience under agentic AI → ADR-020 (was ADR-009) |
| Q4 | Document ACL granularity | P0 | **REOPENED 2026-06-20** — largely moot; only corpus is the how-to manual, news uses ADR-010 taxonomy → ADR-020 |
| Q5 | PDPA-2010 stance | P0 | **LOCKED** — PDPA-aligned from day 1 → ADR-008 |
| Q6 | Session strategy | P0 | **REOPENED 2026-06-20** — Supabase Auth JWT replaces DB sessions; revocation re-solved → ADR-018 / ADR-019 (supersedes ADR-003) |
| Q7 | Conflict dimension matrix | P1 | **LOCKED** as recommended |
| Q8 | Visibility taxonomy | P1 | **LOCKED** — `{public, internal, role-list}` → ADR-010 |
| Q9 | Verify-Registration evidence | P1 | **LOCKED** — Student IC + Admin manual approval |
| Q10 | Parent ↔ Student linking | P1 | **LOCKED** — Admin-only, manual + CSV bulk → ADR-011 |
| Q11 | Golden 100 Q&A ownership | P2 | deferred to next scrum |
| Q12 | UAT participants | P2 | deferred to next scrum |
| Q13 | NFR target sign-off | P2 | **LOCKED** — targets in `00-master-plan.md` §11.3 accepted |
| Q14 | Cost budget + paying account | P3 | **LOCKED for FYP** — free tier dev, paid Gemini in production |
| Q15 | Production runbook owner | P3 | deferred to next scrum |
| Q16 | Facebook integration scope + direction + credential ownership + PDPA cross-border | P0 | **OPEN 2026-06-20** — Proposed → ADR-022 |
| Q17 | News engagement model + minor-UGC moderation + Student participation | P0 | **OPEN 2026-06-20** — Proposed → ADR-021 |
| Q18 | How-to manual authoring ownership | P1 | **OPEN 2026-06-20** — Proposed |
| Q19 | Image storage for manual assets | P1 | **OPEN 2026-06-20** — Supabase Storage candidate → ADR-019 platform line |

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

**Status: REOPENED 2026-06-20 (was LOCKED 2026-05-05).** The v1 answer treated RAG as a single document-Q&A surface with one audience. The agentic AI re-design splits the surface into modes, so "audience" is no longer one switch but a per-mode policy. See ADR-020 (supersedes ADR-009).

v1 answer (carried forward as the read-only / grounded baseline): Admin + Teacher + Parent; Student excluded on under-13 + LLM-interaction PDPA risk.

v2 re-scope — audience is resolved per mode:

- [x] **Modes 1 and 2 (read/retrieve over published content) inherit news visibility** — a user sees exactly the news a non-AI request would return under the ADR-010 `{public, internal, role-list}` taxonomy. No separate AI audience list.
- [x] **Initiating an AI turn (any mode that calls the model) requires an authenticated non-Student principal in v1** — i.e. Admin, Teacher, or Parent. This preserves the v1 exclusion of Students and anonymous users from model interaction.
- [ ] **Student / anonymous AI access — deferred to v2**, gated on the PDPA minor-consent design (Q5 / ADR-008) and the engagement decision in Q17 / ADR-021.

Rationale: grounding the model only on content the principal may already read collapses the old per-audience RAG ACL into the existing visibility taxonomy, and keeps the under-13 LLM-interaction risk out of v1 without a second access matrix.

### Q4. Document ACL granularity

**Status: REOPENED 2026-06-20 (was TENTATIVE 2026-05-05) — largely MOOT.** The v1 question assumed a multi-document corpus with mixed sensitivities, each needing an `acl_key`. Under the agentic re-design the only embedded corpus is the **public / internal how-to manual** (see Q18), and news-grounded AI reads live `news` rows, not a document store. There is no longer a heterogeneous document set whose granularity needs deciding. See ADR-020.

- [x] **Per-document ACL is retired for v1.** The how-to manual carries a single coarse visibility (`public` or `internal`), not a per-document `acl_key` denormalised onto chunks.
- [x] **News-grounded AI reuses the ADR-010 visibility taxonomy** (`{public, internal, role-list}`) at retrieval time — the same gate non-AI reads use — instead of a parallel document-ACL field.
- [ ] Per-folder / per-chunk ACL — moot; no folder hierarchy or mixed-sensitivity corpus exists in v1.

If the school later supplies a genuinely mixed-sensitivity document set, this question reopens with the v1 options on the table; until then the design carries no `document.acl_key`.

### Q5. PDPA-2010 + minor consent stance

**Status: LOCKED 2026-05-05** — PDPA-aligned design from day 1. See [ADR-008](../00-meta/decision-log.md).

Implementation includes Privacy Notice in BM and EN, parental consent template for under-13, IC numbers column-encrypted at rest, audit log on every student-data access, DSAR (data subject access request) endpoint, designated DPO on the Privacy Notice, breach notification ≤ 72 h runbook. Production turn-on with real data is gated on signed parental consents + paid Gemini tier + signed Surat Kebenaran from school principal.

- [x] **Prepare full PDPA-aligned design now**, even if FYP1/2 data is synthetic.
- [ ] Defer PDPA design to post-FYP. (Rejected — examiner risk + school will refuse production turn-on.)

### Q6. Session strategy

**Status: REOPENED 2026-06-20 (was LOCKED 2026-05-05).** Adopting Supabase Auth (ADR-018) moves identity and sessions into managed `auth.users` with **JWT-based sessions**, which displaces the v1 "DB sessions in Supabase" answer and the ADR-003 rationale behind it. See ADR-018 and ADR-019 (supersede ADR-003).

- [ ] **Database sessions in Supabase** (v1 answer) — chosen for *instant* permission revocation when a teacher leaves. No longer available: Supabase Auth issues JWTs.
- [x] **Supabase Auth JWT sessions** with a custom access-token hook (`add_rbac_claims`) injecting lightweight claims (role codes, status, dept ids) into `app_metadata`.

The v1 instant-revocation requirement is **re-solved, not abandoned** (ADR-019): a short access-token TTL (5-15 min) bounds stale claims, **per-request app-layer permission resolution** makes revocation effectively instant for every app-layer-gated route, and a Supabase admin session-revoke is issued on role change. Caveat carried from ADR-019: in v1 the service-role connection bypasses `0001_rls_policies.sql`, so RLS is a correct-but-bypassed safety net until the v2 authenticated-key migration.

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

## P0 — re-baseline additions (2026-06-20)

### Q16. Facebook integration — scope, direction, credential ownership, PDPA cross-border

**Status: OPEN 2026-06-20 — Proposed.** The re-baseline surfaced Facebook as an in-scope channel but left four sub-questions unresolved. See ADR-022.

Sub-questions and recommended positions:

- **Scope** — which surface integrates with Facebook.
  - [x] **Recommended:** outbound announcement mirroring only (portal news → SRIAAWP Page post), no inbound comment/DM ingestion in v1.
  - [ ] Two-way (mirror out + pull comments/messages into the portal). Rejected for v1 — pulls third-party UGC and minor data into scope.
- **Direction** — push, pull, or both.
  - [x] **Recommended:** push (portal → Facebook) only.
  - [ ] Pull or bidirectional. Deferred with the two-way scope above.
- **Credential ownership** — who owns the Page access token and app registration.
  - [ ] Student personal Meta developer app. Rejected — token dies with the student account; not handover-safe.
  - [x] **Recommended:** SRIAAWP-owned Meta Business app + Page token held by the school, supplied to the portal as a server-side secret. Confirms a school owner exists before build.
- **PDPA cross-border** — Facebook is a non-Malaysian processor; cross-border transfer must be assessed.
  - [x] **Recommended:** publish-only of already-`public` news contains no personal data beyond what the school already posts publicly, so v1 stays within the synthetic-data envelope. **Any inbound path (comments, DMs) is deferred** until the PDPA cross-border transfer assessment under Q5 / ADR-008 is written.

Recommendation: adopt push-only, school-owned-credential, outbound-public-news-mirror for v1; record inbound + cross-border as a v2 dependency on the PDPA design.

### Q17. News engagement model, minor-UGC moderation, and Student participation

**Status: OPEN 2026-06-20 — Proposed.** The re-baseline asked whether the news surface is read-only or interactive. Interactivity from minors triggers moderation and PDPA obligations, so this is P0. See ADR-021.

- **Engagement model.**
  - [x] **Recommended:** reactions only (lightweight, e.g. a single acknowledgement/like) in v1; free-text comments deferred.
  - [ ] Full comment threads in v1. Rejected — introduces minor-authored free text and a moderation queue before the moderation design exists.
- **Minor-UGC moderation.**
  - [x] **Recommended:** any user-generated content path is **gated behind a moderation design** (pre-publish review or post-publish takedown + audit) that does not yet exist; until it does, no free-text UGC from any role ships.
- **Student participation.**
  - [ ] Students may react/comment in v1. Deferred — coupled to the Q3 Student-AI-access deferral and the Q5 minor-consent design.
  - [x] **Recommended:** Students are read-only on the news surface in v1; their participation reopens with the moderation + minor-consent designs in v2.

Recommendation: reactions-only, no minor UGC, Students read-only in v1; carry full commenting + Student participation as a v2 item dependent on a written moderation policy and ADR-008.

## P1 — re-baseline additions (2026-06-20)

### Q18. How-to manual authoring ownership

**Status: OPEN 2026-06-20 — Proposed.** The how-to manual is now the **only** embedded AI corpus (see Q4), so its authoring owner and review cadence are on the critical path for the AI surface, not a documentation afterthought.

- [ ] Student authors the manual unilaterally. Weak — the student is not the authority on school process and leaves after the FYP.
- [x] **Recommended:** school champion (Mohamad Faiz Azizan / Izzatul Izyan Abd Hamid) owns manual content and accuracy; student structures and ingests it. Establishes a post-FYP content owner.
- [ ] Co-authored with no named owner. Rejected — no accountable owner for content the AI grounds on.

Open item: confirm the named owner and a per-section review/sign-off cadence at the next sign-off.

### Q19. Image storage for manual assets

**Status: OPEN 2026-06-20 — Supabase Storage candidate.** The how-to manual will carry screenshots/figures; v1 needs a storage target for binary assets distinct from the relational store. This rides on the platform consolidation in ADR-019.

- [x] **Recommended:** **Supabase Storage** — already in the stack post-ADR-018, served over signed URLs, visibility aligned to the manual's `public` / `internal` flag (Q4). No new vendor.
- [ ] Commit images into the repository. Rejected — bloats git history; not a runtime asset store.
- [ ] Third-party object store / CDN. Rejected for v1 — adds a vendor and a second credential owner without need at FYP scale.

Open item: confirm the public/internal bucket split and signed-URL TTL at the next sign-off.

---

## Sign-off

**v1 (2026-05-05).** Student-signed only; supervisor and school countersignature were never obtained — these rows stayed blank, so no countersigned baseline was ever sealed.

| Role | Name | Date | Signature |
|---|---|---|---|
| Student | Muhammad Arif Hakimi | 2026-05-05 | (electronic — see commit history) |
| Supervisor | Dr Zatul Alwani Shaffiei | | (not obtained on v1) |
| School champion | Mohamad Faiz Azizan / Izzatul Izyan | | (not obtained on v1) |

**v2 (2026-06-21 re-baseline).** Reopens Q3 / Q4 / Q6 and adds Q16-Q19. Because v1 was never countersigned, v2 supersedes it cleanly. Supervisor + Pengetua (school principal) countersignature is **required** on v2 before any reopened or new answer is treated as locked — it was already outstanding from v1.

| Role | Name | Date | Signature |
|---|---|---|---|
| Student | Muhammad Arif Hakimi | 2026-06-21 | (electronic — see commit history) |
| Supervisor | Dr Zatul Alwani Shaffiei | | (required on v2) |
| Pengetua / School champion | Pengetua SRIAAWP; Mohamad Faiz Azizan / Izzatul Izyan | | (required on v2) |

After supervisor + Pengetua countersignature, every "LOCKED" answer is referenced from its corresponding ADR in `../00-meta/decision-log.md`. Reopened questions (Q3 / Q4 / Q6) are now governed by ADR-018, ADR-019, and ADR-020; new questions (Q16-Q19) by ADR-021 and ADR-022. Future revisits supersede the ADR rather than overwrite this document.
