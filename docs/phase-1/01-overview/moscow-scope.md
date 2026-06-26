# MoSCoW Scope Baseline

> **Purpose.** This document is the single, authoritative Must / Should / Could / Won't baseline for the whole SRIAAWP Portal — the original four-module proposal scope plus the four changes (C1-C4) agreed at the stakeholder re-baseline. It exists so that every functional requirement traces to a declared tier, and so that the gap between what the signed proposal promised and what v1 will deliver is auditable on examiner day rather than discovered during it.
>
> **Status.** Proposed. This baseline post-dates the 2026-06-20 stakeholder meeting and is pending the supervisor + Pengetua re-sign that supersedes the 2026-05-05 P0 (which carried the student signature only). See ADR-023.
>
> **Sources.** PP.md (PSM1.PF.05, supervisor-signed 16.4.26), PS.md Slides 14/16/22/26, and the 2026-06-20 stakeholder re-baseline. The four changes are governed by ADR-018 and ADR-019 (C1, Supabase Auth), ADR-020..022 (C2, agentic AI modes), and ADR-023 (this baseline). Consumed by functional-requirements.md, use-case-spec.md, scope-pillars.md, and objectives-traceability.md.

Two of the four changes carry no precedent in the signed PP/PS or in any prior ADR: **C3 (Facebook integration)** and **C4 (social engagement)**. They are recorded here as deliberate additions beyond the signed proposal, not as silent absorptions. **C2** also diverges from the PP/PS "RAG over all school documents for all users" promise (thesis FR09; SRS UC16/UC08): v1 narrows public AI to in-article context and a `get_news` function call, gates full document-RAG behind an authored manual, and defers Student AI access. Where a tier item embodies such a divergence, the table says so.

Module codes: **UM** User Management, **DM** Department Management, **IC** Information Dashboard (news / memo / Takwim + conflict-checker), **CR** Co-curricular Record.

## Must (v1 release blockers)

| Item | Scope source | Notes |
|---|---|---|
| UM — User Management | PP/PS Slide 26 module 1 | Manage users & roles, register/login, verify registration, reset password. App-layer RBAC is source of truth (ADR-002 reaffirmed by ADR-019). |
| DM — Department & Document Management | PP/PS Slide 26 module 2 | Upload/delete document, manage departments, view/edit document, per-document ACL. |
| IC — Information Dashboard | PP/PS Slide 26 module 3 | News, memo, Takwim calendar, view/manage events, and the conflict-checker (`<<include>>` from View Calendar). Conflict matrix locked per Master Plan §6 P1. |
| CR — Co-curricular Record | PP/PS Slide 26 module 4 | Submit / review achievement applications, view and update registered co-curricular groups. |
| C1 — Supabase Auth migration | ADR-018, ADR-019 | Replaces Auth.js v5; identity in `auth.users`, `public.profiles` FK'd 1:1; service-role connection retained for v1; lightweight RBAC claims via access-token hook. |
| C2 — AI modes 1-2 | ADR-020, ADR-021 | Mode 1 in-article context (answer about the article being read) + Mode 2 `get_news` function-calling. These are the v1 public AI surface; they replace, and narrow, the PP/PS "RAG for all users" promise. |
| C4 — Engagement (narrow) | 2026-06-20 meeting; ADR-023 | Likes plus parent-question / teacher-answer comment threads on public articles only. Deliberately narrow — see "Won't" for the social-network features explicitly excluded. |

## Should (planned; descope without sinking the project)

| Item | Gate / dependency | Notes |
|---|---|---|
| C2 — AI mode 3 (manual RAG + image links) | Gated on the school manual being authored and the image-storage decision being made | Full document-grounded RAG with image references. If the manual slips, this item slips without threatening the Must tier (ADR-022). Restores part of the PP/PS document-RAG intent for staff/parent audiences. |
| Report generation (UC15) | None hard; built on IC data | Generate report use case from PS Slide 26 module 3. |
| Bulk event import (UC10) | None hard; built on IC event model | Import Event use case from PS Slide 26 module 3; CSV / structured import for term setup. |

## Could (desirable; FYP2 stretch, only if dependencies clear)

| Item | Gate / dependency | Notes |
|---|---|---|
| C3 — Facebook OUTBOUND-only | FYP2; gated on Meta App Review clearing | Portal pushes public news to the school Facebook page. One direction only (portal -> FB). Addition beyond signed PP/PS (ADR-023). |
| C3 — Facebook inbound-as-draft | FYP2; same Meta App Review gate | Inbound FB posts surfaced as unpublished drafts for staff review — never auto-published. Addition beyond signed PP/PS. |

## Won't (v1 — stated explicitly)

| Item | Why excluded | Revisit |
|---|---|---|
| Full real-time bidirectional Facebook sync | Two-way live sync exceeds v1 effort and Meta App Review risk; C3 is outbound-only / inbound-as-draft | v2, contingent on C3 landing |
| Social-network features | Out of scope for a school portal: multi-reaction sets, @mentions, presence indicators, arbitrary comment nesting, edit history. C4 is deliberately the narrow likes + Q&A-thread subset | v2 if stakeholder re-requests |
| Student AI access on public articles | PDPA design constraint on under-13 cohort + LLM interaction (ADR-008, ADR-009). Not a blocker this pass: FYP uses synthetic data only, so no PDPA rule is breached yet (R-12) | v2, pending PDPA review |
| Authenticated-key / RLS-primary connection migration | v1 keeps the service-role connection; RLS remains a bypassed safety net until the authenticated-key path (ADR-019) | v2 per ADR-019 |
| LMS / grading features | Standing exclusion: grading, gradebooks, assignment submission, attendance-as-LMS are not in the proposal and are the canonical scope-creep vector | Permanent (R-07) |

## Out of scope rationale

The standing "Won't" line for **LMS / grading features** is the direct mitigation for risk **R-07** (scope creep into LMS / grading features; probability H, impact M) in the risk register. R-07's mitigation is, verbatim, "MoSCoW with explicit 'Won't' list; reviewed at every supervisor meeting" — this table is that artefact, and the LMS exclusion is its load-bearing entry. The remaining "Won't" items bound the two unprecedented additions (C3, C4) so they cannot expand silently: Facebook is fixed at outbound-only / inbound-as-draft (no bidirectional sync), and engagement is fixed at the narrow likes + parent-question/teacher-answer subset (no general social-network surface). Student AI access and the RLS-primary connection are deferred to v2 by ADR-009/ADR-008 (PDPA, currently non-blocking under synthetic-data-only operation, R-12) and ADR-019 respectively. This baseline is reviewed at every supervisor meeting and re-rated at each sign-off gate; any post-G3 change to it triggers a new ADR.
