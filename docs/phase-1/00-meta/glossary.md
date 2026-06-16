# Glossary

> Single source of truth for domain and technical vocabulary used across the SRIAAWP Portal Phase 1 documentation, thesis chapters, and UI strings. Bahasa Malaysia (BM) and English (EN) entries are listed side-by-side so terminology stays consistent in code, docs, and the portal's BM/EN UI toggle.
>
> **Authoring rule.** When a new domain term enters any artefact (FR, ADR, design doc, UI label), add it here first. When a term's meaning shifts, update this file and bump [`revision-history.md`](./revision-history.md).

---

## Domain — Bahasa Malaysia / school-specific

| Term | Language | Definition | First used in |
|---|---|---|---|
| Takwim | BM | School calendar; aggregated public + role-scoped event view shown on the landing page and parent/staff dashboards. | [`PS.md`](../PS.md) Slide 9 |
| Memo | BM/EN | Internal short-form announcement targeted at one or more roles; visibility scoped via `{public, internal, role-list}` (see [ADR-010](./decision-log.md)). | PS Slide 9 |
| Ko-kurikulum | BM | Co-curricular activity (sports, uniformed body, club). Drives the Co-curricular Record (CR) module and `cocurricular_group` / `enrolment` / `achievement_application` entities. | PS Slide 26 |
| Departmen | BM | Administrative unit inside the school (e.g. Curriculum, Discipline, Hal Ehwal Murid). Maps to the `department` entity and the Department Management (DM) module. | PS Slide 26 |
| Pengetua | BM | School principal. Signs the *Surat Kebenaran*; ultimate sign-off authority for sensitive operations on the school side. | [`PP.md`](../PP.md) §C |
| Surat Kebenaran | BM | Formal letter of permission from the school principal authorising the project to access SRIAAWP data and conduct UAT on premises. Required before real student data lands in the system. | PP §C, [Master plan](../00-master-plan.md) §2 |
| Sekolah Rendah | BM | Primary school (Years 1–6). SRIAAWP is a private Islamic primary school. | PS Slide 4 |
| Tahun | BM | Academic year level (Tahun 1..6). Used as an audience qualifier on memos and events. | PS Slide 26 |
| Darjah | BM | Class within a year level (e.g. *Darjah 3 Soleh*). One Tahun has multiple Darjah. | PS Slide 26 |
| Soleh | BM | Class name suffix used at SRIAAWP (Islamic virtue-named classes). Treat as opaque label inside `darjah.name`. | School convention |
| SRIAAWP | proper noun | *Sekolah Rendah Islam Al-Amin Wilayah Persekutuan*, Sri Rampai, Kuala Lumpur. Primary stakeholder. | PS Slide 4 |
| MJIIT | proper noun | *Malaysia-Japan International Institute of Technology*, UTM. Supervisor's host institute. | PP §B |
| ESE | proper noun | *Department of Electronic System Engineering* at MJIIT. Supervisor's department. | PP §B |
| UTM | proper noun | *Universiti Teknologi Malaysia*. Project's awarding institution. | PP §A |
| FYP1 / FYP2 | EN | *Final Year Project* parts 1 (PSM1, planning) and 2 (PSM2, implementation). Two-semester capstone. | PP §A |
| PSM1 / PSM2 | BM | *Projek Sarjana Muda* parts 1 and 2; UTM's official label for FYP. | PP §A |
| SECx 3032 | proper noun | UTM PSM1 course code under which this project is registered. | [Master plan](../00-master-plan.md) §1 |
| PP | abbr | *Proposal Paper* — UTM PSM1.PF.05 official proposal & supervision-consent form, signed 16.4.26. | [`PP.md`](../PP.md) |
| PS | abbr | *Proposal Slides* — 30-slide proposal deck. | [`PS.md`](../PS.md) |
| Hari Raya | BM | Malaysian public holiday cluster (Aidilfitri, Aidiladha). Drives school-wide blackout windows in the conflict checker. | [Master plan](../00-master-plan.md) §11.6 |

---

## Domain — module / pillar vocabulary

| Term | Definition | Source |
|---|---|---|
| UM | User Management module — accounts, roles, family links, parent verification. FR prefix `FR-UM-*`. | [ADR-001](./decision-log.md) |
| DM | Department Management module — departments, memos, news scoped per department. FR prefix `FR-DM-*`. | ADR-001 |
| IC | Information Dashboard / Information Center — Takwim, news, public landing. FR prefix `FR-IC-*`. (Disambiguation: not to be confused with the Malaysian *IC number*; in this codebase **IC** in an FR-id always means *Information Center*, never the national identity card. See `ic_number_encrypted` for the personal-data column.) | ADR-001 |
| CR | Co-curricular Record module — groups, enrolment, achievement applications. FR prefix `FR-CR-*`. | ADR-001 |
| AI | RAG chatbot subsystem (technically a sub-module of DM, but separate FR prefix because the spec surface is large). FR prefix `FR-AI-*`. | ADR-001 |
| ic_number_encrypted | Column-encrypted (AES-256) Malaysian *Kad Pengenalan* number; access only via DSAR-aware view. | [ADR-008](./decision-log.md) |

---

## Technical — RAG / AI

| Term | Definition |
|---|---|
| RAG | *Retrieval-Augmented Generation*. Pipeline that retrieves relevant document chunks and grounds an LLM's response on them. See [`../03-design/rag-pipeline-design.md`](../03-design/rag-pipeline-design.md). |
| LLM | *Large Language Model*. Locked to `gemini-2.5-flash` for v1 ([ADR-007](./decision-log.md)). |
| Embedding | Dense vector representation of a text chunk; produced by `gemini-embedding-001` at 1536 dimensions ([ADR-006](./decision-log.md)). |
| Chunking | Splitting source documents into retrieval units. Hybrid strategy: heading-based when Markdown is available, else recursive character splitter at 800 tokens with 100-token overlap. |
| pgvector | PostgreSQL extension for vector similarity search. Hosted inside Supabase Postgres ([ADR-005](./decision-log.md)). |
| HNSW | *Hierarchical Navigable Small World* graph index used by pgvector for approximate nearest-neighbour search. Parameters `m=16, ef_construction=64`. |
| MMR | *Maximal Marginal Relevance*. Re-ranking strategy that trades off similarity and diversity (λ=0.5 in this project). |
| BM25 | Best Match 25; classical term-frequency / inverse-document-frequency ranking function. Used in the hybrid retrieval pass via Postgres FTS `tsvector`. |
| RRF | *Reciprocal Rank Fusion*. Combines BM25 and cosine-similarity rankings (k=60). |
| τ_refuse | Refusal threshold on cosine similarity below which the chatbot returns a templated refusal in the user's language. Starts at 0.30; tuned during the pgvector spike. |
| Hallucination | LLM output that is not grounded in the retrieved context. Tracked by RAGAS *faithfulness*; release-blocker if regression > 5 pts. |
| RAGAS | RAG evaluation framework. Metrics: faithfulness, answer relevancy, context precision. Targets in [Master plan](../00-master-plan.md) §11.5. |
| Golden 100 | Hand-curated 100-item question/answer set covering all RAG audiences and document types. Co-authored with school. |
| Citation | Inline reference of the form `[doc_title p.X]` rendered in the chatbot UI; clickable to a `CitationDrawer` with PDF page preview. |
| DPO | *Designated Privacy Officer* under PDPA-2010. Named on the public Privacy Notice. |
| DSAR | *Data Subject Access Request*. PDPA-mandated channel for a parent to request export or deletion of their child's record. |
| Refusal | Templated response returned when retrieval confidence is below threshold OR top-k margin is too thin OR the user's query falls outside the system's scope. |

---

## Technical — auth / security / RBAC

| Term | Definition |
|---|---|
| RBAC | *Role-Based Access Control*. Application layer is the source of truth ([ADR-002](./decision-log.md)). |
| RLS | *Row-Level Security* — Supabase Postgres policy that filters rows per authenticated user. Used as defense-in-depth, mirroring the RBAC matrix. |
| ACL | *Access Control List*. Per-document permission carried denormalised onto each chunk via `acl_key` for fast pre-filter during retrieval. |
| DB session | Server-side session record stored in Supabase, keyed by an opaque cookie. Chosen over JWT for instant revocation ([ADR-003](./decision-log.md)). |
| PDPA | *Personal Data Protection Act* 2010 [Act 709]; with 2024 Amendment. Governs processing of personal data of identifiable individuals in Malaysia. |
| PDP Notice | Public-facing privacy notice in BM and EN, listing purpose, retention, rights, contact for the DPO. |
| Parental consent | PDPA-required consent from a legal guardian before collecting personal data of a minor under 13. Captured via `parental-consent-template.md`. |
| CONFLICT_HARD / SOFT | Conflict-checker outcomes. HARD blocks save (HTTP 409); SOFT allows save as `PENDING_REVIEW`. See [Master plan](../00-master-plan.md) §11.6. |
| Idempotency key | Client-supplied key on `documents.upload` and `events.create` Server Actions to make retries safe. |

---

## Technical — process / spec vocabulary

| Term | Definition |
|---|---|
| ADR | *Architectural Decision Record*. Append-only entry in [`decision-log.md`](./decision-log.md). |
| FR | *Functional Requirement*. 7-field template at [`../98-templates/fr-template.md`](../98-templates/fr-template.md). |
| NFR | *Non-Functional Requirement*. IPA 6-category taxonomy. Targets in [Master plan](../00-master-plan.md) §11.3. |
| UC | *Use Case*. Cockburn-style fully-dressed format. |
| TC | *Test Case*. Given/When/Then; traces back to FR-id. |
| RTM | *Requirements Traceability Matrix*. Objective → FR → UC → TC → Thesis section. |
| MoSCoW | Scope-prioritisation taxonomy: *Must / Should / Could / Won't*. Won't list is explicit and reviewed at every supervisor meeting. |
| RRULE | *Recurrence Rule* per RFC 5545. Used to expand recurring events into `event_occurrence` rows. |
| UEQ | *User Experience Questionnaire* (Laugwitz/Held/Schrepp 2008); 26 items, BM+EN. |
| SUS | *System Usability Scale* (Brooke 1996); 10 items. Target ≥ 68. |
| Heuristics | Nielsen's 10 usability heuristics (Nielsen 1994). |
| WCAG 2.1 AA | Web Content Accessibility Guidelines target for the public Takwim. |
| C4 | Software-architecture diagram notation by Simon Brown; levels L1 (context), L2 (containers) used. |
| RSC | *React Server Component*. Default rendering mode in Next.js 16 App Router. |
| Server Action | Server-only function callable from the client without a hand-written REST endpoint. Used for all mutations ([ADR-004](./decision-log.md)). |
| Route Handler | Next.js 16 file-based HTTP endpoint. Used only for streaming RAG and public-cached Takwim ([ADR-004](./decision-log.md)). |
| proxy.ts | Next.js 16 file convention (renamed from `middleware.ts`); Node.js runtime only. See [ADR-012](./decision-log.md). |
| Cache Components | Next.js 16 caching model that replaces `experimental_ppr`. Default-off in this project; opt routes in selectively ([ADR-014](./decision-log.md)). |
| React Compiler | Babel plugin that auto-memoises client components and removes the need for manual `useMemo` / `useCallback` ([ADR-015](./decision-log.md)). |
