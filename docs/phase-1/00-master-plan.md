# Phase 1 Master Plan — SRIAAWP Portal

> **Purpose.** This is the canonical plan for Phase 1 (FYP1, Waterfall) of the SRIAAWP Portal project. By end of FYP1, every requirement must be specified, every design decision must be locked, and every novel-tech risk must be retired. FYP2 must be pure implementation — if a developer is asking *"what should this do?"* in FYP2, this plan failed.
>
> **Sources.** Inputs: [`PP.md`](./PP.md) (UTM PSM1.PF.05 official proposal & supervision-consent form, signed by Dr Zatul Alwani Shaffiei on 16.4.26) and [`PS.md`](./PS.md) (30-slide proposal deck). All claims here are traceable to those two documents and to the local `CLAUDE.md` / `AGENTS.md`.
>
> **Status.** Draft v1, ready for supervisor review.

---

## 1. Mission

Phase 1 of this project = **FYP1 = Waterfall** ([PS](./PS.md) Slide 19, [PP](./PP.md) p.4 *Technology/Technique*).

Phase 1 maps onto the Japanese-style waterfall stages:

| Stage | Korean/JP term | Phase-1 deliverable family |
|---|---|---|
| Requirements Definition | 要件定義 | `02-requirements/` |
| Basic / External Design | 基本設計 | `03-design/` (architecture, ERD, screens, RBAC) |
| Detailed / Internal Design | 詳細設計 | `03-design/` (DB schema, API spec, algorithms, sequence diagrams) |
| Test plan | テスト計画 | `06-testing/` |
| Process / project management | プロジェクト計画 | `04-methodology/` |
| Tech spikes | 技術検証 | `05-tech-spikes/` |
| Documentation / thesis | 論文 | `07-thesis/` |
| Compliance | 法務・倫理 | `08-compliance/`, `09-stakeholder/` |

The plan also satisfies UTM PSM1 (SECx 3032) academic deliverables: 5-chapter thesis (Intro / Lit Review / Methodology / Proposed Design / Conclusion+FYP2 Plan), Gantt, log book, signed Surat Kebenaran from SRIAAWP, defense slide deck, poster, evaluation forms.

---

## 2. Definition of Done (FYP1 exit criteria)

FYP1 is "done" only when **all** the following are signed by the supervisor and the SRIAAWP stakeholder:

### 2.1 Academic gates (UTM PSM1)

- [ ] Thesis Chapters 1–4 drafted; Chapter 5 outlined with FYP2 plan
- [ ] References ≥ 20 peer-reviewed citations in `references.bib`
- [ ] Gantt chart aligned with the 14-week PSM1 calendar + 14-week PSM2 outline
- [ ] Weekly supervisor log book with ≥ 10 entries countersigned
- [ ] Signed Surat Kebenaran from SRIAAWP principal (replaces Slide 30 "in progress")
- [ ] Proposal defense deck (~18–22 slides) covering Background → Problem → Objectives → Scope → Significance → Lit-Review summary → Methodology → Architecture → Use cases → Design (ERD + sequence) → Eval plan → FYP2 plan → Conclusion
- [ ] Poster (1-page, FoC poster template)
- [ ] All UTM PSM1 forms signed and filed

### 2.2 Engineering gates (Phase-2-implementable)

- [ ] All P0 + P1 decisions in §6 signed off
- [ ] Functional requirements catalogued with FR-IDs in 7-field template
- [ ] Non-functional requirements quantified across IPA's 6 categories
- [ ] RBAC matrix complete (4 roles × all entities × CRUD)
- [ ] ERD finalised; DDL drafted for every entity; pgvector schema committed
- [ ] Supabase RLS policies drafted per table
- [ ] API/Server-Action spec for every mutation
- [ ] RAG pipeline detailed design + golden Q&A set of 100 ready
- [ ] Conflict-detection algorithm specced to pseudocode level with hard/soft matrix
- [ ] Auth & session strategy decided and documented
- [ ] Wireframes for every screen with all 6 states (default, empty, loading, error, success, validation)
- [ ] Tech spikes complete: Next.js 16, Auth.js v5, Supabase RLS, pgvector, Vercel AI SDK, Tailwind v4, React 19 compiler
- [ ] Test plan (UAT + UEQ + RAGAS + heuristic) with sample sizes and instruments
- [ ] PDPA-2010 minor-consent design (parental consent UX, retention, audit log)
- [ ] Risk register and decision log live
- [ ] FYP2 sprint plan with backlog seeded from `user-stories.md`

When every box above is ticked, FYP2 can be opened by running through `03-design/folder-structure-spec.md`, `database-schema.sql.md`, and `api-spec.md` like a recipe — no design questions outstanding.

---

## 3. Stakeholder model

| Actor | Identity | Phase-1 role |
|---|---|---|
| Supervisor | Dr Zatul Alwani Shaffiei (MJIIT, ESE) — [PP](./PP.md) §B | Weekly meeting, sign-off authority on requirements + design |
| School (primary stakeholder) | SRIAAWP — Sekolah Rendah Islam Al-Amin Wilayah Persekutuan, Sri Rampai KL — [PS](./PS.md) Slide 4 | Domain knowledge, sign-off on FR scope, signs Surat Kebenaran, provides golden Q&A material |
| School champion | Mohamad Faiz Azizan + Izzatul Izyan Abd Hamid (per [PS](./PS.md) Slide 30) | Day-to-day stakeholder contact for interviews |
| End users | Admin / Teacher / Parent / Student (per [PS](./PS.md) Slide 26) | Personas for FRs; 5–10 each for UAT |
| Student / dev | Muhammad Arif Hakimi (matric A23MJ5008) | Author of all artefacts |

Communication cadence: **weekly** with supervisor (Mondays), **bi-weekly** with school champion. Every meeting → log book row + decision-log update if a decision was made.

---

## 4. Folder structure

The following tree is the *target end state* of `docs/phase-1/` at FYP1 close. Files marked `(exists)` are already on disk.

```
docs/phase-1/
  README.md                                    -- folder index + how to read
  00-master-plan.md                            -- this file
  PP.md                                        (exists)
  PS.md                                        (exists)
  source/                                      (exists, page-by-page PNGs)
  _scripts/                                    (exists, PDF->PNG renderer)

  00-meta/
    glossary.md                                -- domain terms, BM/EN consistency
    decision-log.md                            -- ADRs (architectural decision records)
    revision-history.md                        -- per-section change log
    references.bib                             -- BibTeX, >=20 entries
    stakeholder-register.md                    -- who, role, contact, influence
    stakeholder-communication-plan.md          -- meeting cadence + evidence
    risk-register.md                           -- risk * prob * impact * mitigation
    log-book.md                                -- weekly supervisor meeting log

  01-overview/
    project-charter.md                         -- 1-page elevator pitch from PP
    scope-pillars.md                           -- 3 pillars (PS s9) <-> 4 modules (PS s26)
    moscow-scope.md                            -- Must / Should / Could / Won't (out of scope)
    objectives-traceability.md                 -- Obj1/Obj2/Obj3 -> downstream artefacts
    success-criteria.md                        -- FYP1 + FYP2 done definitions
    p0-decisions-to-lock.md                    -- the schema-blocking questions

  02-requirements/
    stakeholder-interview-guide.md             -- semi-structured script per persona
    stakeholder-interview-notes.md             -- raw notes, dated, with consent
    user-personas.md                           -- 4 personas with goals + frustrations
    functional-requirements.md                 -- FR-<MOD>-<NN>, 7-field template
    non-functional-requirements.md             -- IPA 6 categories with targets
    rbac-matrix.md                             -- 4 roles x entities x CRUD
    use-case-spec.md                           -- Cockburn-style for every UC in PS s26
    user-stories.md                            -- INVEST-format, fed to FYP2 backlog
    traceability-matrix.md                     -- Obj -> FR -> UC -> TC -> Thesis section

  03-design/
    system-architecture.md                     -- C4 L1+L2
    deployment-diagram.md                      -- Vercel + Supabase topology
    sequence-diagrams.md                       -- 5 critical paths
    data-model-erd.md                          -- entities + crow's-foot
    database-schema.sql.md                     -- DDL prose
    rls-policy-design.md                       -- per-table policy from RBAC
    api-spec.md                                -- server actions + route handlers
    rag-pipeline-design.md                     -- ingestion / embed / retrieve / generate
    conflict-checker-design.md                 -- algorithm + pseudocode
    auth-and-session-design.md                 -- Auth.js v5 + session strategy
    folder-structure-spec.md                   -- target src/ tree for FYP2
    ui-design-system.md                        -- Tailwind v4 tokens + component inventory
    screen-flow-map.md                         -- per-actor screen graph
    wireframes/
      00-index.md
      public.md                                -- landing, takwim, news, login
      parent.md
      student.md
      teacher.md
      admin.md
      chat.md                                  -- AI chat (one of the 2 trickiest)
      event-create.md                          -- conflict-modal flow

  04-methodology/
    sdlc-hybrid-rationale.md                   -- waterfall+agile justification with citations
    fyp1-waterfall-plan.md                     -- entry/exit criteria per phase
    fyp2-agile-plan.md                         -- sprint cadence + ceremonies
    gantt-fyp1.md                              -- Mermaid gantt over 14 weeks
    gantt-fyp2.md                              -- Mermaid gantt over 14 weeks
    tools-and-environment.md                   -- Node version, env vars, local Supabase

  05-tech-spikes/
    learning-checklist.md                      -- "must do without docs by FYP2 start"
    spike-nextjs-16.md                         -- read node_modules/next/dist/docs/
    spike-react-19-compiler.md                 -- babel-plugin-react-compiler implications
    spike-authjs-v5-app-router.md              -- v5 beta API surface
    spike-supabase-rls.md                      -- write & break a policy
    spike-pgvector-rag.md                      -- 5 docs + 10 hand-written QA pairs
    spike-vercel-ai-sdk.md                     -- streaming, tools, citations
    spike-tailwind-v4.md                       -- v4 config-less + @theme

  06-testing/
    test-strategy.md                           -- pyramid + coverage + CI gates
    uat-plan.md                                -- scenarios per persona
    ueq-questionnaire.md                       -- 26-item, BM+EN
    sus-questionnaire.md                       -- 10-item complement
    heuristic-eval-checklist.md                -- Nielsen 10
    rag-quality-eval-plan.md                   -- RAGAS metrics + golden 100
    test-cases-fr.md                           -- TC per FR (Given/When/Then)
    acceptance-criteria.md                     -- module-level gates

  07-thesis/
    front-matter.md                            -- abstract EN+BM, ToC placeholder
    ch1-introduction.md
    ch2-literature-review.md                   -- 6 sub-areas (see 11.4)
    ch3-methodology.md
    ch4-proposed-design.md                     -- synthesises 03-design/
    ch5-conclusion-and-fyp2-plan.md
    appendices.md                              -- PP, PS, RTM, UEQ, transcripts, Surat

  08-compliance/
    pdpa-compliance-notes.md                   -- minor data, retention, breach
    pdp-notice-en.md                           -- public-facing data notice
    pdp-notice-bm.md
    parental-consent-template.md
    ethics-considerations.md                   -- UTM ethics route check

  09-stakeholder/
    surat-kebenaran-sriaawp.md                 -- letter status; replace with PDF when signed
    interview-consent-en.md
    interview-consent-bm.md
    interview-transcripts/                     -- de-identified, dated

  10-presentation/
    defense-slide-outline.md                   -- ~20-slide outline
    poster-outline.md                          -- 1-page FoC poster
    short-paper-outline.md                     -- if SECJH track requires it

  11-forms/
    README.md                                  -- which official forms exist
    psm1-pf-05-proposal.md                     -- pointer to PP.md
    draft-report-submission-form.md            -- placeholder for end of FYP1
    project-evaluation-form.md

  98-templates/
    fr-template.md
    use-case-template.md
    nfr-template.md
    test-case-template.md
    adr-template.md
    spike-template.md

  99-archive/
    .gitkeep                                   -- old versions live here
```

---

## 5. Workstreams

Each workstream below has a **goal**, the **artefacts** it produces, the **inputs** it depends on, and the **effort** in person-days. Effort key: S ≈ 0.5 d, M ≈ 1–2 d, L ≈ 3–5 d.

### WS-A — Project meta & charter

**Goal.** Set up the project's connective tissue: glossary, references, decision log, risk register, stakeholder register, communication cadence.

| Artefact | Inputs | Effort |
|---|---|---|
| `00-meta/glossary.md` | PP, PS Slide 4 (Vision/Mission), Malay terms | S |
| `00-meta/decision-log.md` (template + first 5 ADRs) | This plan | S |
| `00-meta/revision-history.md` | — | S |
| `00-meta/references.bib` | seed Chui 2012, IMusleh, E-SMART; grow during Ch 2 | S |
| `00-meta/stakeholder-register.md` | PP §B, PS Slide 30 | S |
| `00-meta/stakeholder-communication-plan.md` | — | S |
| `00-meta/risk-register.md` (seeded) | this plan §8 | S |
| `00-meta/log-book.md` | weekly meetings | M (over phase) |
| `01-overview/project-charter.md` | PP §C | S |
| `01-overview/scope-pillars.md` | PS Slide 9 vs Slide 26 | S |
| `01-overview/moscow-scope.md` | stakeholder negotiation | M |
| `01-overview/objectives-traceability.md` | PP Objectives | S |
| `01-overview/success-criteria.md` | this §2 | S |
| `01-overview/p0-decisions-to-lock.md` | this §6 | S (already drafted in §6) |

Total: ~6 person-days spread across the semester.

### WS-B — Requirements engineering (要件定義)

**Goal.** Produce a complete, traced, signed-off requirements set.

| Artefact | Inputs | Effort |
|---|---|---|
| `stakeholder-interview-guide.md` | personas, PP, PS | M |
| `stakeholder-interview-notes.md` | 2 rounds × 4 persona types | L |
| `user-personas.md` | interviews | M |
| `functional-requirements.md` (~60–80 FRs across UM, DM, IC, CR, AI) | use-case diagram + interviews | L |
| `non-functional-requirements.md` (IPA 6 categories) | this §11.3 | M |
| `rbac-matrix.md` (4 roles × entities × CRUD) | personas + FRs | M |
| `use-case-spec.md` (Cockburn for every UC in PS s26) | FRs | L |
| `user-stories.md` | FRs | M |
| `traceability-matrix.md` (Obj → FR → UC → TC → Thesis) | all of WS-B | M |

Total: ~14 person-days. **Critical path** lives here.

**Sample FR template** (also in `98-templates/fr-template.md`):

```
FR-IC-04 — Schedule Conflict Check
Actor: Teacher, Admin
Description: System detects scheduling conflicts before an event is persisted as PUBLISHED.
Pre: actor authenticated; has event:create on target dept; event has start_at, end_at, room_id?, organizer_id, audience_ref.
Main flow:
  1) Submit draft.
  2) System runs detectConflicts(event).
  3) [] -> persist PUBLISHED, return 201.
Alt flows:
  3a) hard conflicts -> 409 CONFLICT_HARD with conflicting event ids.
  3b) only soft -> persist PENDING_REVIEW, 202 CONFLICT_SOFT, admin override required.
Post: audit row in event_audit; if published, outbox row.
Exceptions:
  E-01 invalid range (end<=start) -> 422
  E-02 audience_ref deleted -> 422
  E-03 detection timeout >500ms -> 503 (fail-closed)
NFR refs: NFR-PERF-02 (p95 < 500 ms), NFR-SEC-03 (server-side RBAC).
Source: PS Slide 10 + interview-2025-MM-DD.
```

### WS-C — System design (基本設計 + 詳細設計)

**Goal.** Lock every design decision so FYP2 has zero re-design work.

| Artefact | Effort | Notes |
|---|---|---|
| `system-architecture.md` (C4 L1 context, L2 containers) | M | browser → Next.js RSC → Supabase Postgres + pgvector + Storage + Auth → AI provider |
| `deployment-diagram.md` | S | Vercel + Supabase regions, env, secrets, CDN |
| `sequence-diagrams.md` (5 paths) | M | (1) Parent views Takwim, (2) Teacher upload → embed, (3) RAG ask → answer, (4) Event create + conflict, (5) Achievement submit/approve |
| `data-model-erd.md` | L | ~20 entities incl. `users, role, permission, role_permission, user_role, department, family_link, student_profile, staff_profile, parent_profile, cocurricular_group, enrolment, achievement_application, event, event_occurrence, event_audience, room, blackout_window, news, memo, document, document_version, document_chunk, embedding(vector), chat_session, chat_message, retrieval_log, audit_log, outbox, idempotency` |
| `database-schema.sql.md` | M | DDL prose; pgvector dim pinned; tstzrange exclusion constraint on rooms |
| `rls-policy-design.md` | L | per-table policy mirroring `rbac-matrix.md`; defense-in-depth, app layer is source of truth |
| `api-spec.md` | L | Server Actions for mutations; Route Handlers only for streaming RAG + public Takwim cache; standardised `ActionResult<T>` shape; idempotency keys for upload/event-create |
| `rag-pipeline-design.md` | M | see §11.5 below for the locked design |
| `conflict-checker-design.md` | M | see §11.6 |
| `auth-and-session-design.md` | M | Auth.js v5; **DB sessions, not JWT**; per-role registration flows incl. parent-verify |
| `folder-structure-spec.md` | S | target `src/` for FYP2; route groups `(public)`, `(auth)`, `(parent)`, `(staff)`, `(admin)` |
| `ui-design-system.md` | M | Tailwind v4 tokens, component inventory (Button, Card, Calendar, FileTable, ChatBubble, ConflictBadge, ...), responsive bps, BM/EN toggle |
| `wireframes/` (6+ screens × 6 states each) | L | see §11.7 below for the trickiest two |
| `screen-flow-map.md` | S | per-actor directed graph |

Total: ~30 person-days. WS-C is parallelisable internally once WS-B is signed.

### WS-D — Methodology & schedule

| Artefact | Effort | Notes |
|---|---|---|
| `sdlc-hybrid-rationale.md` | S | cite Royce 1970, Sommerville 2016 ch.2, Pressman 2020 ch.4, Beck 2001, PMI hybrid white paper |
| `fyp1-waterfall-plan.md` | S | entry/exit criteria per phase |
| `fyp2-agile-plan.md` | S | 2-week sprints, weekly demo with supervisor, definition of ready/done |
| `gantt-fyp1.md` (Mermaid) | M | aligned to 14-week PSM1 calendar, see §7 |
| `gantt-fyp2.md` (Mermaid) | S | with UAT at week 11–12 |
| `tools-and-environment.md` | S | Node LTS pin, `.nvmrc`, `.editorconfig`, local Supabase via Docker, env taxonomy |

Total: ~5 person-days.

### WS-E — Tech spikes (技術検証)

**Goal.** Retire every novel-tech risk during FYP1 so FYP2 never blocks on docs. Each spike follows the template *Goal / Docs read / Hello-world reproduced / Pitfalls / Decision / Code patterns to copy*.

The repo's [`AGENTS.md`](../../AGENTS.md) explicitly states *"This is NOT the Next.js you know... Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."* — every spike must consult the **locally installed** docs, not training-data assumptions.

| Spike | Effort | Output decision |
|---|---|---|
| `spike-nextjs-16.md` | M | App Router caching defaults, Server Actions, route groups, middleware |
| `spike-react-19-compiler.md` | S | what auto-memoisation breaks/enables; whether to keep `babel-plugin-react-compiler` |
| `spike-authjs-v5-app-router.md` | M | v5 beta API surface; pinned beta version; `auth()` helper edge vs node |
| `spike-supabase-rls.md` | M | sample policy, prove cross-tenant block, JWT claim shape |
| `spike-pgvector-rag.md` | L | extension on, vector column, ingest 5 docs, query, measure recall over 10 hand-written QA |
| `spike-vercel-ai-sdk.md` | M | streaming chat, tool calls, citation post-processing, model selection. **Note: `ai` package is currently NOT in `package.json` — add and pin during this spike** |
| `spike-tailwind-v4.md` | S | `@theme` tokens, `@tailwindcss/postcss` pipeline |
| `learning-checklist.md` | S | "do without docs by FYP2 start" list |

Total: ~12 person-days. Spikes run **in parallel with WS-B** because they need only the tech stack list (already locked in [PP](./PP.md) p.3–4).

### WS-F — Testing & evaluation plan

| Artefact | Effort | Notes |
|---|---|---|
| `test-strategy.md` | S | pyramid: unit (Vitest), integration (Vitest + Supabase test DB), component (Playwright CT), E2E (Playwright), RAG eval (RAGAS), UAT, UEQ, OWASP ZAP baseline |
| `uat-plan.md` | M | scripts per role, success criteria, evaluator recruitment (5 admin + 10 teachers + 10 parents + 5 students) |
| `ueq-questionnaire.md` | S | 26-item Laugwitz/Held/Schrepp 2008, BM+EN, scoring sheet, benchmark target = "Above Average" |
| `sus-questionnaire.md` | S | 10-item Brooke 1996 complement; target ≥ 68 |
| `heuristic-eval-checklist.md` | S | Nielsen 10, 3–5 evaluators |
| `rag-quality-eval-plan.md` | M | RAGAS — faithfulness ≥ 0.85, answer relevancy ≥ 0.80, context precision ≥ 0.70; golden 100 Q&A co-authored with stakeholder |
| `test-cases-fr.md` | L | TC per FR derived from RTM |
| `acceptance-criteria.md` | S | module-level gates that the school sign-off form will check |

Total: ~9 person-days.

### WS-G — Thesis writing

| Artefact | Effort | Notes |
|---|---|---|
| `front-matter.md` | S | abstract EN + BM (300–500 words each per UTM SPS 2023 manual) |
| `ch1-introduction.md` | M | Background, Problem, Objectives (verbatim from PP), Scope, Significance, Research Framework, Thesis Organisation |
| `ch2-literature-review.md` | L | 6 sub-areas (see §11.4), ≥ 20 refs |
| `ch3-methodology.md` | M | hybrid waterfall+agile with citations; elicitation methods; eval methods; Gantt embedded |
| `ch4-proposed-design.md` | L | synthesises `03-design/` for examiner: architecture, ERD, key sequence diagrams, RAG pipeline, screen mockups, RBAC summary, NFR table |
| `ch5-conclusion-and-fyp2-plan.md` | M | what's done; what's next; risks |
| `appendices.md` | S | links to PP, PS, RTM, UEQ, interview transcripts, Surat Kebenaran |

Total: ~14 person-days. Mostly parallel with everything else, ramping at end of phase.

Use the **UTM PSM template (System Development variant)** — Times New Roman 12, 1.5 line spacing, 3.25 cm left margin, 2.5 cm other margins (per UTM SPS 2023 thesis manual). Source: `comp.utm.my/psm/psm-materials`.

### WS-H — Compliance & ethics

This is the highest-risk gap in the current proposal. PP/PS do not mention PDPA-2010 anywhere, yet the system stores identifiable minor (under-13) data.

| Artefact | Effort |
|---|---|
| `pdpa-compliance-notes.md` (purpose, retention, disclosure, rights, breach ≤ 72 h, 2024 amendment) | M |
| `pdp-notice-en.md` + `pdp-notice-bm.md` | M |
| `parental-consent-template.md` (under-13 minors) | S |
| `ethics-considerations.md` (UTM ethics route — confirm with supervisor whether REC submission is required for under-13 cohort) | S |
| `09-stakeholder/surat-kebenaran-sriaawp.md` | S (chase signature) |
| `09-stakeholder/interview-consent-en.md` + `interview-consent-bm.md` | S |

Total: ~5 person-days. Earliest possible start.

### WS-I — Defense materials

| Artefact | Effort |
|---|---|
| `10-presentation/defense-slide-outline.md` (~20 slides, FoC defense format = 20 min present + 10 min Q&A, 2 evaluators) | M |
| `10-presentation/poster-outline.md` (FoC poster template) | S |
| `10-presentation/short-paper-outline.md` (if SECJH requires; confirm) | S |
| `11-forms/*` | S (collect on submission) |

Total: ~3 person-days.

---

## 6. Decisions to lock (P0/P1/P2/P3)

These are the blocking decisions. **Without P0, no schema can be drawn. Without P1, no detailed UI can be drawn. Without P2, no test plan can be written.** A separate companion document, [`01-overview/p0-decisions-to-lock.md`](./01-overview/p0-decisions-to-lock.md), is formatted for sign-off by Dr Zatul Alwani + the SRIAAWP champion.

### P0 — schema-blocking (locked 2026-05-05)

1. **Embedding model + dimension.** **LOCKED** — `gemini-embedding-001` with `outputDimensionality=1536`. Free tier during FYP development; paid tier for production turn-on (PDPA opt-out of model training). See [ADR-006](./00-meta/decision-log.md).
2. **LLM vendor + cost ownership.** **LOCKED** — `gemini-2.5-flash` (GA). Free tier for FYP1 spike + FYP2 development; paid tier for production. School pays once production deploy occurs. Re-evaluate Gemini 3.x against 2.5 if 3.x reaches GA before deploy. **Multi-key rotation rejected** — violates Google ToS. See [ADR-007](./00-meta/decision-log.md).
3. **RAG audience.** **LOCKED** — Admin + Teacher + Parent. Student excluded in v1 (PDPA risk on under-13 + LLM interaction). See [ADR-009](./00-meta/decision-log.md).
4. **Document ACL granularity.** **TENTATIVE — per-document** with `acl_key` denormalised onto each chunk for fast pre-filter. Confirm against real document samples once school provides them.
5. **PDPA-2010 + minor consent stance.** **LOCKED** — PDPA-aligned design from day 1: Privacy Notice in BM+EN, parental consent for under-13, IC numbers column-encrypted, audit log on every student-data access, DSAR flow, designated DPO, breach notification ≤ 72 h. See [ADR-008](./00-meta/decision-log.md).
6. **Session strategy.** **LOCKED** — database sessions in Supabase (instant revocation). See [ADR-003](./00-meta/decision-log.md).

### P1 — UI-blocking (locked 2026-05-05)

7. **Conflict dimension matrix.** **LOCKED** — room+time = HARD (DB exclusion constraint), organizer+time = SOFT, audience+time = SOFT (HARD if `priority=EXAM`), dept blackout = SOFT, school-wide blackout (Hari Raya / exam weeks / Friday prayer 12:30–14:30) = HARD with admin override available.
8. **Visibility taxonomy.** **LOCKED** — `{public, internal, role-list}`. Department-level scoping handled via department-coded role codes in the role-list rather than a separate `dept_id` column. See [ADR-010](./00-meta/decision-log.md).
9. **Verify-Registration evidence.** **LOCKED** — Student IC + Admin manual approval before parent account is activated.
10. **Parent ↔ Student linking.** **LOCKED** — Admin-only creation; tool supports both single manual entry and bulk CSV import at start of school year. Parents cannot self-link. Parents **cannot** view their student's AI chat history (`chat_session.user_id` filter is strictly self). See [ADR-011](./00-meta/decision-log.md).

### P2 — test-plan-blocking

11. Golden 100 Q&A ownership — **DEFERRED to next scrum.**
12. UAT participant recruitment — **DEFERRED to next scrum.**
13. **NFR target sign-off.** **LOCKED** — targets in §11.3 accepted as written.

### P3 — operational

14. **Cost budget + paying account.** **LOCKED for FYP** — free Gemini tier + Vercel/Supabase free tier during development. Switch to paid Gemini tier and re-evaluate Vercel/Supabase plans when deploying with real student data; school assumes cost from production turn-on. Single API key; no multi-key rotation.
15. Production runbook owner at SRIAAWP — **DEFERRED to next scrum.**

---

## 7. Sequencing & critical path

```
WS-A (charter, glossary, stakeholder reg)
  v
WS-B stakeholder-interview-guide
  v
WS-B interview-notes (round 1)
  v
WS-B personas + FR draft  --- in parallel ---  WS-E spikes (NextJS, Auth.js, Supabase, pgvector, AI SDK)
  v                                              v
WS-B FR sign-off  <------- depends on -------- WS-E decisions feed FR/NFR
  v
WS-B NFR + RBAC matrix
  v
WS-B use-case-spec + user-stories + RTM
  v
WS-C system-architecture --> data-model-erd --> database-schema --> rls-policy-design
                          --> api-spec
                          --> rag-pipeline-design (uses spike output)
                          --> conflict-checker-design
                          --> auth-and-session-design
                          --> ui-design-system --> wireframes --> screen-flow-map
                          --> folder-structure-spec
  v
WS-F test plan (uses RTM)
  v
WS-G thesis chapters (cite everything above)
  v
WS-I defense + poster

WS-D (methodology + Gantt) parallel with WS-A throughout.
WS-H (compliance) parallel from week 1; signed Surat blocks any UAT in FYP2.
```

**Critical path:** stakeholder interviews → FR sign-off → ERD → screens → Ch 4. Buffer must protect this. Risk register §8 watches for the typical blockers.

### 14-week PSM1 calendar (Mermaid sketch)

```mermaid
gantt
    title FYP1 Master Schedule (PSM1, 14 weeks)
    dateFormat  W
    axisFormat  W%V

    section Charter & Meta
    Charter, glossary, stakeholder register     :a1, 1, 1w
    Risk + decision logs ongoing                :a2, 1, 14w

    section Compliance (parallel)
    Surat Kebenaran chase                       :h1, 1, 4w
    PDPA notice + parental consent template     :h2, 2, 3w

    section Tech spikes (parallel)
    NextJS 16 + Tailwind v4                     :e1, 1, 2w
    AuthJS v5 + Supabase RLS                    :e2, 2, 2w
    pgvector + Vercel AI SDK + RAG hello-world  :e3, 3, 3w

    section Requirements
    Interview guide + round 1 interviews        :b1, 2, 2w
    FR draft (~60-80 FRs)                       :b2, 4, 2w
    NFR + RBAC matrix                           :b3, 5, 1w
    Use case spec + user stories                :b4, 6, 1w
    Round 2 interviews + FR sign-off            :b5, 7, 1w

    section System design
    Architecture + ERD                          :c1, 7, 2w
    DB schema + RLS                             :c2, 8, 1w
    API spec + auth design                      :c3, 8, 2w
    RAG pipeline design                         :c4, 9, 1w
    Conflict checker design                     :c5, 9, 1w
    UI design system + wireframes               :c6, 9, 3w
    Folder structure spec                       :c7, 11, 1w

    section Test plan
    Test strategy + UEQ + UAT scripts           :f1, 11, 2w
    RAGAS eval plan + golden 100                :f2, 11, 2w
    Test cases per FR                           :f3, 12, 2w

    section Thesis & defense
    Ch1, Ch3 drafts                             :g1, 5, 4w
    Ch2 lit review                              :g2, 6, 5w
    Ch4 design synthesis                        :g3, 11, 3w
    Ch5 + appendices                            :g4, 13, 1w
    Defense slide deck + poster                 :i1, 13, 2w

    section Buffer
    Buffer + revisions                          :z1, 14, 1w
```

---

## 8. Risk register (initial — owned in `00-meta/risk-register.md`)

| # | Risk | P | I | Mitigation |
|---|---|---|---|---|
| R-01 | Surat Kebenaran from SRIAAWP delays past week 4 | M | H | Submit draft letter week 1; weekly chase; supervisor escalation route |
| R-02 | PDPA-2010 minor-consent design rejected | L | H | Engage compliance scope week 1; consult MJIIT examples of student-data systems |
| R-03 | Next.js 16 / Auth.js v5 beta API churn | M | M | Pin exact versions; spike report per `AGENTS.md` directive (read `node_modules/next/dist/docs/`); track Auth.js v5 release notes weekly |
| R-04 | Supabase RLS + app-layer RBAC drift (silent leak) | M | H | Single source of truth = app layer; RLS as defense-in-depth; integration tests must include cross-tenant attack cases |
| R-05 | RAG hallucination or weak retrieval in Malay/Arabic content | M | M | Gemini Embedding + Gemini Flash both handle Malay; tune τ_refuse during pgvector spike; golden 100 Q&A; weekly RAGAS regression check; refusal template ready in BM/EN |
| R-06 | OCR for Jawi script needed but not budgeted | L | M | Confirm with school whether Jawi appears in real documents (P0 Q4 follow-up); if yes, switch to Google Document AI; if no, Tesseract is fine |
| R-07 | Scope creep into LMS / grading features | H | M | MoSCoW with explicit "Won't" list; reviewed at every supervisor meeting |
| R-08 | Stakeholder availability during school holidays / Hari Raya | M | M | Front-load interviews; identify alternate respondents; pre-book sessions |
| R-09 | UEQ / UAT recruitment short of n=30 | M | M | Identify backup parent/teacher pool early; offer small incentive (school-branded merch?) |
| R-10 | Gantt slips because critical path stalls on FR sign-off | M | H | Hard week-7 deadline; supervisor sign-off ceremony scheduled in calendar |
| R-11 | Free Gemini tier 1,500 req/day cap hit during UAT (n=30 users + RAGAS regression runs) | M | M | Single shared API key + per-user rate limit + nightly RAGAS run rather than per-PR; if regularly capped, accelerate paid-tier migration to UAT phase |
| R-12 | Free Gemini tier ToS allow Google to train on inputs — PDPA conflict if real student data is used pre-deploy | M | H | FYP1 spike + FYP2 dev use **synthetic** documents only; real SRIAAWP documents only land in the system after paid-tier flip + signed parental consents (ADR-007, ADR-008) |

---

## 9. Sign-off gates (milestones)

| Gate | When | What is signed |
|---|---|---|
| G1 — Charter & P0 decisions | Week 3 | Project charter, P0 decision document, signed Surat Kebenaran |
| G2 — Requirements freeze | Week 7 | FR catalogue, NFR table, RBAC matrix, use-case spec, RTM stub |
| G3 — Design freeze | Week 11 | Architecture, ERD, schema, API spec, RAG pipeline, conflict spec, wireframes |
| G4 — Test plan + thesis draft | Week 13 | Test strategy, UAT/UEQ instruments, Ch 1–4 drafts |
| G5 — Defense ready | Week 14 | Defense slides, poster, all UTM forms, log book, FYP2 sprint plan |

A signed gate means: supervisor + school champion (where relevant) have read, raised issues, and approved. Any change after a gate triggers a `decision-log.md` ADR.

---

## 10. Quality bar per artefact type

| Artefact | "Good" looks like |
|---|---|
| FR | 7-field template; FR-ID; sourced (interview/PP/PS); pre+main+alt+post+exception; cited from at least one TC and one screen |
| NFR | quantified target; measurement method; owner; IPA category tag |
| Use case (Cockburn) | actor, scope, level, primary success scenario, extensions, technology variations |
| ERD entity | columns + types + nullability + FK + indexes + check constraints + comments |
| API endpoint | path/action name, auth, RBAC permission code, request schema (Zod), response schema, errors, rate-limit, idempotency, examples |
| Wireframe | every screen has all 6 states drawn (default, empty, loading, error, success, validation) |
| Sequence diagram | actors + lifelines + messages + activations + notes for failure modes |
| Test case | Given/When/Then, traces to FR-ID, automated or manual flag |
| Spike report | docs read (with version), what worked, what failed, decision with reasoning, copy-pastable code snippet |
| Decision (ADR) | context, options considered, decision, consequences, status, supersedes? |
| Thesis chapter | matches UTM SPS 2023 typography; cites references.bib; figures numbered + captioned; no hand-waving |

---

## 11. Cross-cutting deliverables

These artefacts touch >1 file and must stay in lockstep. Single source of truth named per artefact.

### 11.1 Glossary

- File: `00-meta/glossary.md`
- Why: BM + EN consistency in thesis and UI. Examples: *Takwim* (school calendar), *Memo*, *Ko-kurikulum*, *Departmen*, *Pengetua*, *Surat Kebenaran*, *RAG*, *RBAC*, *RLS*, *pgvector*, *embedding*, *chunking*, *MMR*, *RRULE*.

### 11.2 RBAC matrix

- File: `02-requirements/rbac-matrix.md`
- Consumed by: `rls-policy-design.md`, `auth-and-session-design.md`, `api-spec.md`, `test-cases-fr.md`, every wireframe.
- Format: rows = (resource, action) pairs with permission codes (`document:upload`, `event:approve`, `cr:auto_approve`); columns = roles (Admin, Teacher, Parent, Student) — but with **scope qualifiers** (e.g. Teacher.dept_id). The model is *role × scope*, not flat role.

### 11.3 NFR table (IPA 非機能要求グレード, sized for one private primary school)

| Category | Metric | Target |
|---|---|---|
| 可用性 | Monthly uptime | 99.5% (~3.6 h/mo down OK) |
| 可用性 | RPO / RTO | 24 h / 4 h |
| 可用性 | Maintenance window | Sat 23:00–01:00 MYT |
| 性能・拡張性 | p95 page TTFB | ≤ 800 ms |
| 性能・拡張性 | p95 RAG TTFT | ≤ 2 s; full ≤ 8 s |
| 性能・拡張性 | p95 conflict check | ≤ 500 ms |
| 性能・拡張性 | Concurrent users | 200 sustained, 500 burst |
| 運用・保守性 | Log retention | App 30 d / audit 1 y / AI prompts 90 d |
| 運用・保守性 | Backup retention | 7 daily, 4 weekly, 6 monthly |
| 運用・保守性 | Mean time to deploy | ≤ 15 min via Vercel preview → prod |
| 移行性 | Schema migrations | Drizzle/Prisma up+down, zero-downtime |
| 移行性 | Initial bulk import | CSV (users/students), Drive folder dump (docs) |
| セキュリティ | Auth | Auth.js v5 + DB sessions |
| セキュリティ | RBAC enforcement | App layer + Supabase RLS (defense in depth) |
| セキュリティ | PDPA-2010 | Parental consent for under-13; DSAR flow; breach notification ≤ 72 h |
| セキュリティ | Encryption | TLS 1.3 in transit, AES-256 at rest, IC numbers column-encrypted |
| セキュリティ | OWASP Top 10 | ZAP baseline + npm audit before UAT |
| 環境 | Browser support | Last 2 versions Chrome/Edge/Safari + Android Chrome |
| 環境 | Accessibility | WCAG 2.1 AA on public Takwim |
| 環境 | i18n | UI: EN+BM toggle. Content: BM/EN/Arabic-aware. Jawi pending P0 confirmation. |

### 11.4 Literature review skeleton (Chapter 2)

Six sub-areas, target 20–25 references. Seed list (full list lives in `references.bib`):

1. **School Management / Student Information Systems** — adoption, architecture (~3–4 refs).
2. **Retrieval-Augmented Generation in education** — Lewis et al. 2020 NeurIPS (canonical RAG); MDPI 2025 *RAG Chatbots for Education* survey; ScienceDirect *RAG for Educational Application: Systematic Survey* 2025.
3. **Conflict-aware / educational timetabling** — Babaei et al. 2015 (survey); Bardoulet 2024 (recent); ETASR 2020 review.
4. **RBAC in K-12 / education** — Sandhu et al. 1996 (canonical RBAC); Ferraiolo, Kuhn & Chandramouli 2007.
5. **Usability evaluation methodology** — Laugwitz/Held/Schrepp 2008 (UEQ); Brooke 1996 (SUS); Nielsen 1994 (heuristics); ISO 9241-11:2018.
6. **PDPA / minor data in Malaysia** — PDPA 2010 [Act 709]; PDP (Amendment) Act 2024.

Plus methodology citations for Chapter 3: Royce 1970 (waterfall origin); Sommerville 2016 ch.2; Pressman 2020 ch.4; Beck et al. 2001 (Agile Manifesto); PMI hybrid white papers.

### 11.5 RAG pipeline locked design

Single source of truth: `03-design/rag-pipeline-design.md`. Summary of locked decisions:

- **Ingest**: PDF / DOCX / XLSX / TXT / MD; max 25 MB; OCR fallback required; reject scanned-image PDFs unless OCR succeeds; Jawi handling pending P0 Q1.
- **Chunking**: hybrid — split on Markdown headings if available, else recursive character splitter at 800 tokens with 100-token overlap. Persist `page_from / page_to` for citation back to PDF page.
- **Embedding**: `gemini-embedding-001` with `outputDimensionality=1536`. Pin `model='gemini-embedding-001'` and `dim=1536` per row in `embedding` table so model upgrades can run two models in parallel during migration. Free tier (1,500 req/day) for FYP development; **paid tier for production turn-on** to opt out of Google's model-training use of inputs (PDPA — see ADR-008). Vector column type: `vector(1536)`.
- **Vector store**: pgvector inside Supabase (no new infra). HNSW index `m=16, ef_construction=64`.
- **Retrieval**: top-k = 8 → MMR re-rank to 4 (λ=0.5) for diversity; hybrid BM25 (Postgres FTS `tsvector`) + cosine fused via reciprocal-rank fusion (k=60).
- **RBAC pre-filter** (not post-filter): SQL `WHERE acl_key = ANY($user_acl_keys)` *before* similarity scan. Post-filtering leaks via timing.
- **Generation**: Vercel AI SDK + `gemini-2.5-flash` (GA). Temperature 0.2; max_tokens 1024; system prompt includes school context + language policy + refusal rules + citation format `[doc_title p.X]`. Free tier for FYP; paid tier in production. Per-user rate limit 20 req/min (NFR-PERF) keeps the free tier 1,500 req/day cap sustainable for ~50 active users/day.
- **Refusal**: if max similarity < τ_refuse OR top1 − top2 < 0.05 → refuse with templated message in user's language. **τ_refuse starts at 0.30 cosine but must be tuned during the pgvector spike against the golden 100** since Gemini's similarity distribution differs from open-source models.
- **RAG audience**: Admin + Teacher + Parent only. Student role is denied `rag:query` permission in v1 (ADR-009).
- **Audit**: every query logs `user_id, query_text, chunk_ids[], scores[], model, latency_ms, refused_reason?` to `retrieval_log`.
- **Eval**: golden 100 Q&A co-authored with school; RAGAS metrics — faithfulness ≥ 0.85, answer relevancy ≥ 0.80, context precision ≥ 0.70; weekly during FYP2; release-blocker on regression > 5 pts.

### 11.6 Conflict-detection algorithm locked spec

Single source of truth: `03-design/conflict-checker-design.md`.

**Dimensions:**

1. Time overlap of `tstzrange(start_at, end_at)`.
2. Same `room_id` + time overlap → **HARD** (DB exclusion constraint).
3. Same `organizer_id` + time overlap → **SOFT**.
4. Same `audience_ref` + time overlap → **SOFT** unless `priority=EXAM` then **HARD**.
5. Same `dept_id` overlap during department blackout → **SOFT**.
6. School-wide blackout (Hari Raya, mid-term break, exam weeks, Friday prayer 12:30–14:30) → **HARD** unless override.

**Hard** → `409 CONFLICT_HARD`, list conflicting events.
**Soft** → save as `PENDING_REVIEW`; admin-only override with reason (audited).
**Recurrence** → store RRULE; expand to 12-month sliding window in `event_occurrence` materialised table; conflict checks run against materialised rows. Re-materialise on RRULE edit.

Pseudocode:

```
detectConflicts(e):
  blocks = []
  for occ in expand(e):
    if overlapsAny(blackout_window, occ): blocks += {kind:"BLACKOUT", hard:true}
    if e.room_id and overlapsRoom(occ): blocks += {kind:"ROOM", hard:true}
    if overlapsOrganizer(occ): blocks += {kind:"ORGANIZER", hard:false}
    if overlapsAudience(occ):
      hard = (e.priority == "EXAM")
      blocks += {kind:"AUDIENCE", hard}
  return blocks
```

p95 < 500 ms with `tstzrange` GiST indexes.

### 11.7 Trickiest screens (must be wireframed first)

**Screen 1 — AI Chat** (`wireframes/chat.md`).
Components: `ChatPage` → `ChatHeader` (department filter chip, model badge), `MessageList` → `MessageBubble[]` → `CitationChip` (click → `CitationDrawer` with PDF page preview), `RefusalBubble`, `Composer` (textarea + send), `RetrievalDebugPanel` (admin-only, top-k chunks + scores), `FeedbackBar` (thumbs up/down + reason). Stream via Vercel AI SDK `useChat`. State matrix: empty / loading / error / refused / success / validation. Persist `chat_session` per user; max 50 sessions retained.

**Screen 2 — Event Create with Conflict Check** (`wireframes/event-create.md`).
`EventForm` (title, body, start/end via `DateTimeRange`, recurrence builder, organizer auto-fill, dept select, room select, audience picker, visibility, priority) → on Save: `ConflictModal` lists blocks grouped by `kind` (room, audience, blackout, organizer); each item has "View event" link. CTAs: "Edit", "Save anyway as Pending Review" (soft only), "Request Override" (admin only, reason textarea required). State matrix: empty / loading / conflict-modal / success-toast / validation-error / saved-but-pending.

### 11.8 Requirements Traceability Matrix (RTM)

- File: `02-requirements/traceability-matrix.md`
- Format: Objective → FR-ID → Use Case → Test Case → Thesis section. CSV-friendly.
- Why: examiner Q&A weapon. Single artefact that proves nothing dropped.

### 11.9 Gantt

- Files: `04-methodology/gantt-fyp1.md` + `gantt-fyp2.md`
- Format: Mermaid `gantt` blocks; same notation; embedded in Ch 3.

---

## 12. Conventions

- **No emojis** anywhere (per `~/.claude/rules/style.md`).
- **File naming**: kebab-case, lowercase, `.md` for prose, `.sql.md` for DDL prose (so it lints as Markdown but reads as SQL), `.bib` for BibTeX.
- **Diagrams**: Mermaid-first (so they live in Markdown and can't drift). Fall back to Excalidraw + PNG export only if Mermaid is genuinely insufficient.
- **Citations in thesis chapters**: `[author, year]` inline, full entry in `references.bib`. No URL-only citations except for the Malaysian competitor sites (IMusleh, E-SMART) which are grey literature.
- **ADR per significant decision**: numbered, in `decision-log.md`. Linked from any artefact that depends on it.
- **Versioning**: `revision-history.md` tracks per-section bumps. Old versions move to `99-archive/<file>-vN.md` rather than `git log` archaeology.
- **Code blocks in design docs**: TypeScript for types, SQL for schema, prose for everything else.

---

## 13. Templates

Drafts of templates live in `98-templates/`. Use them — don't reinvent format.

- `fr-template.md` — the 7-field FR shape used in `functional-requirements.md`.
- `use-case-template.md` — Cockburn-style fully-dressed UC shape.
- `nfr-template.md` — NFR row + measurement method.
- `test-case-template.md` — Given/When/Then.
- `adr-template.md` — context / options / decision / consequences.
- `spike-template.md` — goal / docs read / hello-world / pitfalls / decision / patterns.

---

## 14. Open questions for the supervisor

1. Confirm UTM PSM1 evaluation rubric weighting (the FoC PSM Form page returned 403 during research — supervisor likely has the latest copy).
2. Confirm whether SECJH PSM1 requires the **short paper** or only the **poster + thesis + defense**.
3. Confirm whether under-13 cohort triggers UTM-REC ethics submission, or whether supervisor approval + Surat Kebenaran is sufficient.
4. Confirm the SECJH-track expectation around language of the thesis (BM, EN, or both).
5. Confirm whether a **prototype / proof-of-concept** is required at FYP1 close (some FoC tracks ask for a minimum viable prototype; this plan keeps Phase 1 design-only per the proposal's stated waterfall split, but tech spikes do produce working hello-worlds).

---

## 15. Sources & supporting reviews

- [`PP.md`](./PP.md) — UTM PSM1.PF.05 official proposal & supervision-consent form, signed 16.4.26.
- [`PS.md`](./PS.md) — 30-slide proposal deck.
- [`AGENTS.md`](../../AGENTS.md) — repo-level note on Next.js 16 doc reading discipline.
- [`CLAUDE.md`](../../CLAUDE.md) — project-level conventions.
- UTM Faculty of Computing PSM1 page: https://comp.utm.my/psm/psm-1/
- UTM PSM Materials (templates): https://comp.utm.my/psm/psm-materials/
- UTM SPS Thesis Writing Guidelines 2023: https://sps.utm.my/wp-content/uploads/2024/06/Thesis-Guideline-18.10.2023-1-1.pdf
- MJIIT FYP1 writing guide: https://mjiit.utm.my/wp-content/uploads/2018/09/FYP-1-How-to-Write-Thesis.pdf
- UEQ Handbook: https://www.ueq-online.org/Material/Handbook.pdf
- Malaysia PDPA 2010: https://www.pdp.gov.my/ppdpv1/en/akta/pdp-act-2010-en/

This plan also incorporates findings from three parallel internal review passes (architect / UTM PSM1 academic / 要件定義+詳細設計 engineering rigor) — references in the project's Phase-1 review notes.
