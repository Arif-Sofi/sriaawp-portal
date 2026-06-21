# Risk Register

> Live register of project risks. Seeded from [Master plan §8](../00-master-plan.md). Reviewed at every weekly supervisor meeting; new rows appended; closed rows kept with `Status = Closed` and a date.
>
> Probability / Impact scale: `L` low, `M` medium, `H` high. Risk score is implied (L×L = trivial, H×H = critical) but not numerically computed — the table is short enough to read directly.
>
> **Default owner.** Author (Muhammad Arif Hakimi) unless explicitly delegated.

| ID | Risk | Category | Probability | Impact | Mitigation | Owner | Last reviewed |
|---|---|---|---|---|---|---|---|
| R-01 | *Surat Kebenaran* from SRIAAWP delays past week 4 | Stakeholder / scheduling | M | H | Submit draft letter week 1; weekly chase; supervisor escalation route | Author | 2026-05-05 |
| R-02 | PDPA-2010 minor-consent design rejected by school or examiner | Compliance | L | H | Engage compliance scope week 1; consult MJIIT examples of student-data systems; ADR-008 sets PDPA-aligned design from day 1 | Author | 2026-05-05 |
| R-03 | Next.js 16 beta API churn breaks the foundation | Tech | M | M | Pin exact versions; spike report per [`AGENTS.md`](../../../AGENTS.md) directive (read `node_modules/next/dist/docs/`); **Auth.js v5 retired by ADR-018 (Supabase Auth)** — residual Next.js 16 churn only; Supabase SSR integration tracked as R-17 | Author | 2026-06-20 |
| R-04 | Supabase RLS + app-layer RBAC drift (silent data leak) | Security | M | H | Single source of truth = app layer (ADR-002); RLS as defense-in-depth; integration tests must include cross-tenant attack cases; periodic audit script | Author | 2026-05-05 |
| R-05 | RAG hallucination or weak retrieval in Malay/Arabic content | AI quality | M | M | Gemini Embedding + Gemini Flash both handle Malay; tune τ_refuse during pgvector spike; golden 100 Q&A; weekly RAGAS regression check; refusal template ready in BM/EN | Author | 2026-05-05 |
| R-06 | OCR for Jawi script needed but not budgeted | Tech / scope | L | M | Confirm with school whether Jawi appears in real documents (P0 Q4 follow-up); if yes, switch to Google Document AI; if no, Tesseract is fine | Author | 2026-05-05 |
| R-07 | Scope creep into LMS / grading features | Scope | H | M | MoSCoW with explicit "Won't" list; reviewed at every supervisor meeting; new feature requests routed through P1/P2 decision queue | Author | 2026-05-05 |
| R-08 | Stakeholder availability collapses during school holidays / Hari Raya | Stakeholder | M | M | Front-load interviews; identify alternate respondents; pre-book sessions across the term; calendar published to school champion | Author | 2026-05-05 |
| R-09 | UEQ / UAT recruitment short of n=30 across Admin / Teacher / Parent / Student cohorts | Evaluation | M | M | Identify backup parent/teacher pool early; offer small incentive (school-branded merch); recruit from neighbouring SRI schools as last resort | Author | 2026-05-05 |
| R-10 | Gantt slips because critical path stalls on FR sign-off | Schedule | M | H | Hard week-7 deadline; supervisor sign-off ceremony scheduled in calendar; pre-send draft 5 days before; G2 gate is calendared, not floating | Author | 2026-05-05 |
| R-11 | Free Gemini tier 1,500 req/day cap hit during UAT (n=30 users + RAGAS regression runs) | Cost / capacity | M | **H** (re-rated 2026-06-20) | Single shared API key + per-user rate limit + nightly RAGAS run; agentic AI (ADR-020) multiplies calls per turn (tool-calling 2+ round-trips, article context-stuffing) — re-derive the TPM/RPD budget before UAT; accelerate paid-tier if capped | Author | 2026-06-20 |
| R-12 | Free Gemini tier ToS allow Google to train on inputs — PDPA conflict if real student data is used pre-deploy | Compliance | M | H | FYP1 spike + FYP2 dev use **synthetic** documents only; real SRIAAWP documents only land in the system after paid-tier flip + signed parental consents (see ADR-007, ADR-008) | Author | 2026-05-05 |
| R-13 | Meta App Review / Business Verification blocks or delays Facebook outbound sync | External dependency | M | H | School owns the Meta app and starts Business Verification early; outbound MVP scoped to one Page-post call; gated on `spike-facebook-graph-api.md`; Facebook is a *Could* so a stalled review does not block the core deliverable (ADR-022) | Author | 2026-06-20 |
| R-14 | Bidirectional Facebook sync loop / duplicate ingestion | Tech | M | M | `fb_sync_link` + `content_hash` dedup + `unique(origin, external_id)`; inbound is poll-only and ingested as draft; full bidirectional sync is an explicit MoSCoW Won't (ADR-022, ADR-023) | Author | 2026-06-20 |
| R-15 | Facebook content-model mismatch corrupts ingested content | Tech | M | M | Outbound maps a defined subset (title, body excerpt, canonical link, primary image); inbound (if ever) ingests as Admin-moderated draft (ADR-022) | Author | 2026-06-20 |
| R-16 | Scope creep into full bidirectional Facebook sync (R-07 materialising) | Scope | H | M | MoSCoW Won't-line (ADR-023); every two-way / real-time request routed through the P1/P2 queue; cross-linked to R-07 | Author | 2026-06-20 |
| R-17 | Supabase Auth migration regresses shipped PR #25; @supabase/ssr cookie/refresh on Next.js 16 `proxy.ts` mis-wired (silent logout) | Tech | M | H | Spike `spike-supabase-auth-ssr` before the migration PR; preserve `getCurrentUser`/`requireUser`/`hasPermission`/`requirePermission` signatures so the cut-over touches ~5 lib files not ~48 consumers; reuse `auth.users` uuid as profile PK so FKs survive (ADR-018/019) | Author | 2026-06-20 |
| R-18 | Minor-authored UGC (news comments) creates moderation / safeguarding exposure | Compliance / safety | M | H | Mandatory moderation (teacher/admin hide+delete-any, report flow), audit-logged and DSAR-covered; post-moderation + per-user rate limit; Student commenting excluded in v1 pending school sign-off; non-blocking under synthetic-data scope (ADR-021, ADR-008) | Author | 2026-06-20 |

---

## Review cadence

- **Weekly** (Mondays, supervisor meeting): scan all open rows; bump `Last reviewed`; promote/demote probability/impact based on the week's evidence; raise new rows to the supervisor.
- **At each sign-off gate** (G1..G5 — see [stakeholder-communication-plan.md](./stakeholder-communication-plan.md)): full re-rate of every open row.
- **On any decision-log ADR**: cross-check whether the ADR closes or amends a row here, and link in both directions.

## Closing convention

When a risk is materially retired (e.g. R-03 once the Next.js 16 spike lands and the auth-and-session-design.md is signed), append `Status: Closed YYYY-MM-DD — <one-line reason>` to the Mitigation cell rather than deleting the row. Permanent record beats clean tables.
