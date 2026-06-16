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
| R-03 | Next.js 16 / Auth.js v5 beta API churn breaks the foundation | Tech | M | M | Pin exact versions; spike report per [`AGENTS.md`](../../../AGENTS.md) directive (read `node_modules/next/dist/docs/`); track Auth.js v5 release notes weekly | Author | 2026-05-05 |
| R-04 | Supabase RLS + app-layer RBAC drift (silent data leak) | Security | M | H | Single source of truth = app layer (ADR-002); RLS as defense-in-depth; integration tests must include cross-tenant attack cases; periodic audit script | Author | 2026-05-05 |
| R-05 | RAG hallucination or weak retrieval in Malay/Arabic content | AI quality | M | M | Gemini Embedding + Gemini Flash both handle Malay; tune τ_refuse during pgvector spike; golden 100 Q&A; weekly RAGAS regression check; refusal template ready in BM/EN | Author | 2026-05-05 |
| R-06 | OCR for Jawi script needed but not budgeted | Tech / scope | L | M | Confirm with school whether Jawi appears in real documents (P0 Q4 follow-up); if yes, switch to Google Document AI; if no, Tesseract is fine | Author | 2026-05-05 |
| R-07 | Scope creep into LMS / grading features | Scope | H | M | MoSCoW with explicit "Won't" list; reviewed at every supervisor meeting; new feature requests routed through P1/P2 decision queue | Author | 2026-05-05 |
| R-08 | Stakeholder availability collapses during school holidays / Hari Raya | Stakeholder | M | M | Front-load interviews; identify alternate respondents; pre-book sessions across the term; calendar published to school champion | Author | 2026-05-05 |
| R-09 | UEQ / UAT recruitment short of n=30 across Admin / Teacher / Parent / Student cohorts | Evaluation | M | M | Identify backup parent/teacher pool early; offer small incentive (school-branded merch); recruit from neighbouring SRI schools as last resort | Author | 2026-05-05 |
| R-10 | Gantt slips because critical path stalls on FR sign-off | Schedule | M | H | Hard week-7 deadline; supervisor sign-off ceremony scheduled in calendar; pre-send draft 5 days before; G2 gate is calendared, not floating | Author | 2026-05-05 |
| R-11 | Free Gemini tier 1,500 req/day cap hit during UAT (n=30 users + RAGAS regression runs) | Cost / capacity | M | M | Single shared API key + per-user rate limit + nightly RAGAS run rather than per-PR; if regularly capped, accelerate paid-tier migration to UAT phase | Author | 2026-05-05 |
| R-12 | Free Gemini tier ToS allow Google to train on inputs — PDPA conflict if real student data is used pre-deploy | Compliance | M | H | FYP1 spike + FYP2 dev use **synthetic** documents only; real SRIAAWP documents only land in the system after paid-tier flip + signed parental consents (see ADR-007, ADR-008) | Author | 2026-05-05 |

---

## Review cadence

- **Weekly** (Mondays, supervisor meeting): scan all open rows; bump `Last reviewed`; promote/demote probability/impact based on the week's evidence; raise new rows to the supervisor.
- **At each sign-off gate** (G1..G5 — see [stakeholder-communication-plan.md](./stakeholder-communication-plan.md)): full re-rate of every open row.
- **On any decision-log ADR**: cross-check whether the ADR closes or amends a row here, and link in both directions.

## Closing convention

When a risk is materially retired (e.g. R-03 once the Next.js 16 spike lands and the auth-and-session-design.md is signed), append `Status: Closed YYYY-MM-DD — <one-line reason>` to the Mitigation cell rather than deleting the row. Permanent record beats clean tables.
