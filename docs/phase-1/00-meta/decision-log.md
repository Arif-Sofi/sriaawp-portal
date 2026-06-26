# Architectural Decision Log

> Append-only ledger of significant decisions made during the project. Format: lightweight ADR (context / options / decision / consequences). Numbered sequentially. Once an ADR is `Accepted`, do not edit it — supersede with a new ADR if the decision changes.
>
> Status values: `Proposed` → `Accepted` → (later) `Superseded by ADR-NNN` or `Deprecated`.

---

## ADR-001 — Use the four-module decomposition (UM, DM, IC, CR) as the canonical structure

**Status.** Proposed.

**Date.** 2026-05-05.

**Context.**
[`PS.md`](../PS.md) Slide 9 names three pillars (Information Center, Administrative Hub, Student Dashboard); Slide 26 names four modules (User Management, Department Management, Information Dashboard, Co-curricular Record). The two views need to be reconciled before requirements can be authored.

**Options.**
1. Use the three-pillar view as canonical; treat User Management as a cross-cutting concern.
2. Use the four-module view as canonical; map pillars to modules in a presentation layer.
3. Define a fifth set ad-hoc.

**Decision.**
Adopt option 2 — the four-module view is the lower-level (implementable) cut. Pillar↔module mapping lives in [`../01-overview/scope-pillars.md`](../01-overview/scope-pillars.md):

| Pillar | Module(s) |
|---|---|
| Information Center | Information Dashboard |
| Administrative Hub | Department Management + RAG chatbot subsystem |
| Student Dashboard | Co-curricular Record + student profile slice of User Management |
| (cross-cutting) | User Management |

**Consequences.**
- FR IDs are prefixed by module (`FR-UM-*`, `FR-DM-*`, `FR-IC-*`, `FR-CR-*`, `FR-AI-*` for the RAG subsystem).
- Folder structure under `02-requirements/` and `03-design/` follows modules, not pillars.
- Thesis Ch 4 narrates by pillar for readability but cites the module-level specs.

---

## ADR-002 — Application layer is the source of truth for RBAC; Supabase RLS mirrors as defense in depth

**Status.** Proposed.

**Context.**
With both Auth.js v5 in the application layer and Supabase RLS at the database, there are two possible enforcement points. Treating both as co-equal sources of truth historically causes "I can't see my own data" bugs and blast-radius confusion when policies disagree.

**Options.**
1. Application layer is sole enforcement; RLS disabled.
2. RLS is sole enforcement; thin application layer.
3. Application layer is source of truth; RLS mirrors policies for defense in depth.

**Decision.**
Option 3.

**Consequences.**
- Every server action / route handler performs an explicit permission check before the DB call.
- RLS policies are mechanically derived from the RBAC matrix; they are tested with cross-tenant attack cases as integration tests.
- A periodic audit script verifies the RLS policies match the RBAC matrix.
- The `auth.jwt()` claim shape becomes part of the contract; bumping it requires session rotation.

---

## ADR-003 — Database sessions, not JWT

**Status.** Proposed.

**Context.**
Auth.js v5 supports both JWT and database session strategies. Permission changes (a teacher leaves the school, a parent's child graduates) must take effect quickly.

**Options.**
1. JWT — fast, stateless, but revocation requires a deny-list or short expiration.
2. Database sessions in Supabase — one extra DB read per request; instant revocation.

**Decision.**
Option 2.

**Consequences.**
- Negligible latency hit at expected scale (≤ 2,500 active users, peak ~50 RPS).
- A `session` table lives in the schema; cleaning it up is a scheduled job.
- Logout, password reset, and role change immediately invalidate sessions.

---

## ADR-004 — Server Actions for mutations + Route Handlers only for streaming / public-cached endpoints

**Status.** Proposed.

**Context.**
Next.js 16 App Router supports RSC, Server Actions, and Route Handlers. A school portal with no third-party API consumer doesn't need REST.

**Options.**
1. REST API for everything via Route Handlers.
2. Server Actions for everything.
3. Server Actions for mutations + Route Handlers for streaming (RAG SSE) and public-cached reads (Takwim).

**Decision.**
Option 3.

**Consequences.**
- End-to-end type safety on mutations without hand-writing request/response schemas.
- Streaming RAG endpoint is `POST /api/rag/ask` (Route Handler with `Response` + `ReadableStream`).
- Public Takwim endpoint is `GET /api/takwim?from&to` (Route Handler, edge-cached 60 s).
- All mutation results follow the standardised `ActionResult<T>` shape (see `../03-design/api-spec.md`).
- Idempotency keys required for `documents.upload` and `events.create`.

---

## ADR-005 — pgvector inside Supabase, not an external vector DB

**Status.** Proposed.

**Context.**
RAG retrieval needs a vector store. Supabase Postgres can host pgvector; alternatives are Pinecone, Weaviate, Qdrant.

**Options.**
1. pgvector in the same Supabase Postgres.
2. External vector DB (Pinecone, Weaviate, Qdrant).
3. In-memory FAISS at request time.

**Decision.**
Option 1.

**Consequences.**
- No new infrastructure or vendor account.
- Joins between vector hits and RBAC scope are normal SQL — no cross-system filter logic.
- HNSW index `m=16, ef_construction=64` for the expected ≤ 100k chunks.
- If chunk count exceeds 1M (we don't expect it), revisit with IVFFlat or external store.

---

## ADR-006 — Use Gemini Embedding (1536-d) for RAG vectors

**Status.** Accepted.

**Date.** 2026-05-05.

**Context.**
RAG retrieval needs an embedding model. The choice locks the `embedding.vector` column dimensionality and the cost / privacy / quality trade-off for chunk indexing. P0-Q1 in [`../01-overview/p0-decisions-to-lock.md`](../01-overview/p0-decisions-to-lock.md). The school's documents are predominantly Bahasa Malaysia and English, with occasional Arabic.

**Options.**
1. BAAI `bge-m3` self-hosted (1024-d, open-source, multilingual). Free at runtime; needs a hosting story.
2. OpenAI `text-embedding-3-small` (1536-d). Strong English; weaker Malay; OpenAI account/cost.
3. Google `gemini-embedding-001` with configurable `outputDimensionality`. Default 3072; recommended presets 768 / 1536 / 3072 (MRL-trained, truncation-safe).

**Decision.**
Option 3 — `gemini-embedding-001` with `outputDimensionality=1536`. Free tier during FYP development; paid tier when production uses real SRIAAWP documents.

**Consequences.**
- `embedding` table column is `vector(1536)`. Pin `model='gemini-embedding-001'` per row so future model upgrades can run side-by-side.
- All chunk ingestion calls Gemini API. Free-tier inputs are used by Google for model training — acceptable for synthetic FYP data, **not** for real SRIAAWP documents in production. ADR-008 (PDPA) requires switching to paid tier before production turn-on.
- HNSW index parameters (`m=16, ef_construction=64`) sized for ≤ 100k chunks.
- Retrieval refusal threshold τ must be tuned during the pgvector spike — Gemini's similarity distribution may not match open-source baselines.
- The Gemini Embedding 2 (`gemini-embedding-2-preview`) multimodal model is on the radar for v2 if the school later wants image-based document ingestion.

**References.**
- [Embeddings | Gemini API](https://ai.google.dev/gemini-api/docs/embeddings)
- [Building with Gemini Embedding 2 | Google Developers Blog](https://developers.googleblog.com/building-with-gemini-embedding-2/)

---

## ADR-007 — Use Gemini 2.5 Flash as LLM; free tier dev, paid tier production; no multi-key rotation

**Status.** Accepted.

**Date.** 2026-05-05.

**Context.**
RAG generation needs an LLM. Cost and privacy posture both must be answered. P0-Q2 + Q14 in [`../01-overview/p0-decisions-to-lock.md`](../01-overview/p0-decisions-to-lock.md). As of May 2026 Google has Gemini 2.5 Flash (GA) and Gemini 3.x previews (3.1 Flash-Lite, 3 Flash Preview).

**Options.**
1. Anthropic Claude Haiku 4.5 (English-strong; per-call cost).
2. OpenAI `gpt-4o-mini` (per-call cost).
3. Google Gemini 2.5 Flash (GA, free tier 1,500 req/day, 1M TPM; paid tier opts out of training).
4. Google Gemini 3.x preview models — newer, in preview, schema may shift.
5. Multi-key free-tier rotation across 3–4 free Gemini accounts.

**Decision.**
Option 3 — `gemini-2.5-flash` (GA). Free tier during FYP1 spike + FYP2 development. Paid tier for production turn-on with real student data. Re-evaluate Gemini 3.x against 2.5 Flash at production deploy if 3.x has reached GA. **Option 5 explicitly rejected** — multi-key rotation violates Google's Terms of Service prohibition on signing up to circumvent service limits, and a single coordinated ban takes the whole rotation down.

**Consequences.**
- Single API key per environment. Per-user rate limit on `/api/rag/ask` (20 req/min) plus aggressive caching keep free tier sustainable for ~50 active users/day.
- Vercel AI SDK provider config selects Gemini; switching to paid tier is an environment variable + billing flip, not a code change.
- Estimated production cost: ≤ MYR 50/mo at ~5,000 RAG queries/month against Gemini 2.5 Flash paid pricing.
- Free-tier ToS allow Google to use inputs for training; FYP1 spike + FYP2 dev therefore use **synthetic** documents only. Real SRIAAWP documents only land in the system after paid-tier flip + parental consents.

**References.**
- [Rate limits | Gemini API](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API Free Tier 2026 — TokenMix](https://tokenmix.ai/blog/gemini-api-free-tier-limits)
- [Google APIs Terms of Service](https://developers.google.com/terms)

---

## ADR-008 — PDPA-2010-aligned design from day 1

**Status.** Accepted.

**Date.** 2026-05-05.

**Context.**
The portal stores identifiable data of children under 13 (names, IC numbers, parent contacts, achievements, possibly photos). Malaysia's Personal Data Protection Act 2010 [Act 709] and the 2024 Amendment apply. P0-Q5. The current proposal documents (PP, PS) do not mention PDPA — academic reviewers flagged this as the single biggest examiner risk.

**Options.**
1. Design PDPA-aligned from day 1. Compliance lives in FYP1 alongside the rest of the spec.
2. Build first, layer compliance on later. High retrofit cost; risk of school refusing production turn-on.

**Decision.**
Option 1.

**Consequences.**
- Privacy Notice authored in BM and EN (`08-compliance/pdp-notice-{bm,en}.md`).
- Parental consent template for under-13 students (`08-compliance/parental-consent-template.md`).
- IC numbers stored column-encrypted (AES-256) using a Supabase-managed key.
- Every read/write of student data writes a row to `audit_log`.
- DSAR (Data Subject Access Request) endpoint design specced — parent can request export or deletion of their child's record.
- Breach notification runbook authored (≤ 72 h notification per amendment, escalation chain documented).
- Designated DPO named on the Privacy Notice — typically the school IT coordinator.
- Production turn-on with real student data is gated on (a) signed parental consents on file, (b) Gemini paid tier active (ADR-007), (c) signed Surat Kebenaran from SRIAAWP principal.

**References.**
- [PDPA 2010 (Act 709) — pdp.gov.my](https://www.pdp.gov.my/ppdpv1/en/akta/pdp-act-2010-en/)

---

## ADR-009 — RAG audience: Admin, Teacher, Parent (Student excluded in v1)

**Status.** Accepted.

**Date.** 2026-05-05.

**Context.**
[`../PS.md`](../PS.md) Slide 11 shows a Parent asking the chatbot ("What is the dress code for graduation ceremony?") but Slide 26 maps Parent only to news/calendar/groups, not to AI chat. Mismatch must resolve before RBAC and UI can be drawn. P0-Q3.

**Options.**
1. Admin + Teacher only (most conservative).
2. Admin + Teacher + Parent (matches Slide 11; most useful; needs careful per-document ACL).
3. All four roles incl. Student (highest impact; under-13 student talking to LLM = high PDPA risk).

**Decision.**
Option 2.

**Consequences.**
- `rag:query` permission is granted to Admin, Teacher, Parent roles; explicitly denied to Student in v1.
- Per-document ACL (P0-Q4 tentative) must support "this doc is parent-visible" vs "this doc is staff-only" so the RBAC pre-filter keeps teacher-only docs out of parents' retrievals.
- The AI chat UI is hidden for Student role.
- Student RAG access is a v2 candidate — revisit after PDPA review of student-LLM interaction.

**References.**
- [`../01-overview/p0-decisions-to-lock.md`](../01-overview/p0-decisions-to-lock.md) Q3.

---

## ADR-010 — Visibility taxonomy: {public, internal, role-list}

**Status.** Accepted.

**Date.** 2026-05-05.

**Context.**
News, Memo, and Event records each need a visibility scope field. P0-Q8.

**Options.**
1. Simpler `{public, internal, role-list}`. `internal` = any authenticated user; `role-list` = explicit list of role codes; `public` = anonymous.
2. Richer 5-way taxonomy `{public, authenticated, role:role_id, dept:dept_id, audience:audience_ref}`.

**Decision.**
Option 1.

**Consequences.**
- Schema column: `visibility enum('public','internal','role_list')` + `visible_role_codes text[] not null default '{}'`.
- Department-level scoping is achieved via department-coded role codes (e.g. `teacher_curriculum`) rather than a separate `dept_id` column on the visibility row. Less normalised, but simpler RLS.
- If audience-level scoping (e.g. "this memo is for Year-3 cohort only") is needed later, add a separate `audience_ref` column rather than overloading `visibility`.

**References.**
- [`../01-overview/p0-decisions-to-lock.md`](../01-overview/p0-decisions-to-lock.md) Q8.

---

## ADR-011 — Admin-only Parent↔Student linking with CSV bulk + per-family edits

**Status.** Accepted.

**Date.** 2026-05-05.

**Context.**
Family relationships drive who sees what for Parents (a Parent's dashboard shows their child's data). The link must be created by a trusted party. P0-Q9 (Parent self-registration verification) + Q10 (link creation).

**Options.**
1. Parent self-claims by entering Student IC + token.
2. Admin creates link manually from school enrolment records.
3. Bulk CSV import at start of school year + per-family Admin edits afterwards.
4. Hybrid 2 + 3 (single tool with both modes).

**Decision.**
Option 4. Admin-only creation; tool supports single-row entry **and** CSV bulk import at start of school year. Parent self-registration produces a `PENDING_VERIFICATION` user who is then approved by Admin (Student IC + Admin manual approval per P0-Q9); the family link is a separate Admin action.

**Consequences.**
- `family_link` rows can only be inserted/updated/deleted by users with `user_management:link_family` permission (Admin role only).
- Parent **cannot** view their student's AI chat history — `chat_session.user_id` filter is strictly self.
- Bulk CSV import is a server action with idempotency key (`csv_sha256` per import); rejected rows reported, accepted rows committed in a single transaction.
- A small Admin UI screen lists pending parent verifications, the Student IC entered, and gives Admin one-click approve / reject.

**References.**
- [`../01-overview/p0-decisions-to-lock.md`](../01-overview/p0-decisions-to-lock.md) Q9, Q10.

---

## ADR-012 — Use `proxy.ts` (not `middleware.ts`) on the Node.js runtime for session refresh and auth gating

**Status.** Accepted.

**Date.** 2026-05-05.

**Context.**
Next.js 16 deprecates the `middleware.ts` file convention. The replacement is `proxy.ts` (or `.js`), with the function renamed from `middleware(request)` to `proxy(request)`. Critically, the Edge runtime is **no longer supported** in `proxy` — the codepath was dropped in v16, leaving Node.js as the only runtime. The `skipMiddlewareUrlNormalize` `next.config.ts` flag is renamed to `skipProxyUrlNormalize`. Source: [`../05-tech-spikes/spike-nextjs-16.md`](../05-tech-spikes/spike-nextjs-16.md) pitfall 2 and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

**Options.**
1. Stick with `middleware.ts`. Rejected — deprecated in v16; build emits a warning today and the file will be removed in a future minor.
2. Use `proxy.ts` on the Node.js runtime. Matches v16 conventions; Auth.js v5 + Supabase clients run cleanly on Node anyway.
3. Bypass `proxy` entirely; do auth checks only in Server Actions / Route Handlers / RSC layouts. Rejected — loses the cross-cutting session-refresh hook on every request, and would push redirect logic into every page layout.

**Decision.**
Option 2 — `proxy.ts` on the Node.js runtime is the canonical file convention going forward.

**Consequences.**
- The file at `proxy.ts` (project root, alongside `next.config.ts`) handles session refresh, auth gating, and request normalisation. It does **not** enforce RBAC — that stays in Server Actions per [ADR-002](#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth).
- Edge-only logic (geo lookups, ultra-low-latency redirects) is no longer available in `proxy`. Any such codepath must move into a Route Handler — but no current FR depends on Edge runtime.
- [`auth-and-session-design.md`](../03-design/auth-and-session-design.md) (placeholder; authored later in WS-C) must reflect the `proxy.ts` location and Node.js runtime.
- `next.config.ts` uses `skipProxyUrlNormalize` (not the old `skipMiddlewareUrlNormalize`) when the URL-normalisation behaviour needs to change. Currently default-on.
- The matcher pattern in [`spike-nextjs-16.md`](../05-tech-spikes/spike-nextjs-16.md) Code pattern 4 is the copy-paste starting point.

**References.**
- [`../05-tech-spikes/spike-nextjs-16.md`](../05-tech-spikes/spike-nextjs-16.md) — pitfall 2, code pattern 4.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`.
- [ADR-002](#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth), [ADR-003](#adr-003--database-sessions-not-jwt).

---

## ADR-013 — Nest pages under a role-named segment inside each role's parenthesised route group

**Status.** Accepted.

**Date.** 2026-05-05.

**Context.**
Next.js 16's parenthesised route groups (e.g. `(parent)`, `(staff)`, `(admin)`) are **organisational only** — they do not alter the URL. Two pages in different groups that resolve to the same URL path cause a build-time error: *"You cannot have two parallel pages that resolve to the same path."* The first scaffold of this repo placed `dashboard/page.tsx` directly inside each role group, all of which resolved to `/dashboard` and the build failed. Source: [`../05-tech-spikes/spike-nextjs-16.md`](../05-tech-spikes/spike-nextjs-16.md) pitfall 1 and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`.

**Options.**
1. Drop route groups entirely; use bare folders (`/parent/...`, `/staff/...`). Rejected — loses the per-role `layout.tsx` injection that route groups exist to enable (the `(parent)/layout.tsx` only wraps parent pages).
2. Nest each role's pages under a role-named segment inside the group: `(parent)/parent/dashboard/page.tsx` → `/parent/dashboard`. Group adds the layout; segment adds the URL prefix. Both concerns separated.
3. Use a top-level `[role]` dynamic segment and route at runtime. Rejected — defeats build-time route checking; harder to type-narrow per-role logic.

**Decision.**
Option 2 — for each authenticated role group `(parent)`, `(staff)`, `(admin)`, pages live under a role-named segment **inside** the group. The `(public)` and `(auth)` groups don't need the prefix because their segments are already URL-distinct (`/`, `/login`).

**Consequences.**
- Folder layout (already in place via the Foundation spike):
  - `src/app/(public)/page.tsx` → `/`
  - `src/app/(auth)/login/page.tsx` → `/login`
  - `src/app/(parent)/parent/dashboard/page.tsx` → `/parent/dashboard`
  - `src/app/(staff)/staff/dashboard/page.tsx` → `/staff/dashboard`
  - `src/app/(admin)/admin/dashboard/page.tsx` → `/admin/dashboard`
- Per-role layouts live at `(parent)/layout.tsx`, `(staff)/layout.tsx`, `(admin)/layout.tsx` — they wrap every page in that role's tree and are the natural place for role-scoped navigation, breadcrumbs, and `auth()` redirects.
- Documented in [`../03-design/folder-structure-spec.md`](../03-design/folder-structure-spec.md) so FYP2 contributors don't repeat the URL-collision mistake.
- New role groups (e.g. a future `(teacher)` if Teacher is split from Staff) follow the same pattern by default.

**References.**
- [`../05-tech-spikes/spike-nextjs-16.md`](../05-tech-spikes/spike-nextjs-16.md) — pitfall 1.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`.

---

## ADR-014 — Cache Components / `cacheComponents` is opt-out for v1; opt routes in selectively

**Status.** Accepted.

**Date.** 2026-05-05.

**Context.**
Next.js 16 removes `experimental_ppr` and replaces it with `cacheComponents: true` in `next.config.ts`. The new model requires the `'use cache'` directive at the function or file level and uses `cacheLife` / `cacheTag` helpers (no longer `unstable_` prefixed). The two are not the same model — turning on `cacheComponents` globally changes the rendering behaviour of every dynamic page in the app, and the data shape for most routes is not finalised yet. Source: [`../05-tech-spikes/spike-nextjs-16.md`](../05-tech-spikes/spike-nextjs-16.md) pitfall 5.

**Options.**
1. Enable `cacheComponents: true` globally in `next.config.ts` from day one. Rejected — the data layer is unwritten; rendering decisions made today would be made on incomplete information.
2. Leave `cacheComponents` default-off; opt individual routes in via the `'use cache'` directive when their data shape is finalised. The first likely opt-in target is `(public)/takwim` (read-heavy, anonymous, edge-cacheable per [ADR-004](#adr-004--server-actions-for-mutations--route-handlers-only-for-streaming--public-cached-endpoints)).
3. Enable globally + add per-route opt-outs. Rejected — opt-in is safer than opt-out for a feature with system-wide rendering implications.

**Decision.**
Option 2.

**Consequences.**
- `next.config.ts` does **not** set `cacheComponents` for v1. The Foundation PR's config is `{ reactCompiler: true }` and stays that way.
- Routes that benefit from caching (public Takwim, public news, possibly the school landing page) opt in by adding `'use cache'` and a `cacheLife` policy when their queries are stable.
- `unstable_cache` / `unstable_cacheLife` / `unstable_cacheTag` are not used — v16 has the stable equivalents.
- A follow-up spike (track in `learning-checklist.md`) profiles the public Takwim under Cache Components and decides the `cacheLife` profile; until then, that route renders fresh on every request.

**References.**
- [`../05-tech-spikes/spike-nextjs-16.md`](../05-tech-spikes/spike-nextjs-16.md) — pitfall 5.
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` (§ Cache Components).
- [ADR-004](#adr-004--server-actions-for-mutations--route-handlers-only-for-streaming--public-cached-endpoints).

---

## ADR-015 — Keep `babel-plugin-react-compiler` enabled with `reactCompiler: true`

**Status.** Accepted.

**Date.** 2026-05-05.

**Context.**
React 19.2 + React Compiler 1.0 are stable as of Next.js 16. The compiler auto-memoises client components, removing the need for manual `useMemo` / `useCallback` in interactive client islands (e.g. `ConflictModal`, `ChatComposer`, `FileTable`, `ChatBubble`). Build time is higher — the compiler relies on Babel — but Next.js's SWC analyser limits the Babel pass to files with JSX/Hooks. Source: [`../05-tech-spikes/spike-react-19-compiler.md`](../05-tech-spikes/spike-react-19-compiler.md).

**Options.**
1. Disable the compiler (`reactCompiler: false`). Faster builds; manual memoisation everywhere.
2. Enable in `compilationMode: 'annotation'` (only components with `'use memo'` opt in). Halfway house; defeats the purpose for an app of this scale.
3. Enable in `compilationMode: 'infer'` (the default when `reactCompiler: true` is set). Compiler decides per-component.

**Decision.**
Option 3 — `next.config.ts` keeps `reactCompiler: true`. The compilation mode is the default `'infer'`. `babel-plugin-react-compiler@1.0.0` stays in `devDependencies`.

**Consequences.**
- Client components in FYP2 do not pre-emptively add `useMemo` / `useCallback`. If profiling reveals a render hotspot the compiler missed, manual memoisation is added deliberately at that point.
- "Rules of React" violations (mutating props, conditional hooks, reading refs during render) silently de-optimise individual components. `eslint-plugin-react-compiler` (bundled with `eslint-config-next`) is the safety net and runs in CI.
- Build cost is acceptable at FYP scale (~80 components expected). Re-evaluation triggers: `next build` exceeds 60 s on `ubuntu-latest`, or a client component shows wrong behaviour traceable to the compiler.
- Escape hatch: a component can opt out with `'use no memo'` at the top. Use only when a specific bug requires it.
- React Server Components are out of scope — the compiler only memoises client component renders.

**References.**
- [`../05-tech-spikes/spike-react-19-compiler.md`](../05-tech-spikes/spike-react-19-compiler.md).
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/reactCompiler.md`.
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` (§ React Compiler Support).
- https://react.dev/learn/react-compiler/introduction.

---

## ADR-016 — Drizzle ORM as the schema source of truth; drizzle-kit for generation; manual SQL for RLS

**Status.** Accepted.

**Date.** 2026-05-06.

**Context.**
The portal needs an ORM/migration story before any feature schema can land. The candidates are Prisma, Drizzle, Kysely, and raw SQL. The Foundation spike already endorsed Drizzle in [`folder-structure-spec.md`](../03-design/folder-structure-spec.md) but did not record the rationale. PR #24 ships the first migration, so the decision must be locked.

A second decision rides along: how to author RLS policies. Drizzle's RLS API exists but is evolving; raw SQL is more auditable and reads cleanly into the thesis appendix.

**Options.**
1. Prisma. Mature, generates a typed client, has its own DSL, and supports migrations. Bundle size is heavy and the generated client is a runtime adapter, not a query-builder you can step through. RLS support requires raw SQL anyway.
2. Drizzle ORM. SQL-first; types inferred from the schema definitions; lightweight runtime; explicit migrations via `drizzle-kit generate`. Has a first-party `@auth/drizzle-adapter` for Auth.js v5 (which we adopt per ADR-003).
3. Kysely. Excellent type-safety on hand-written SQL but no migration tool of its own; we would still need `drizzle-kit` or hand-rolled migrations.
4. Raw SQL via `node-postgres`. Maximum control; minimum ergonomics; type-safety only via `pg-types`. Rejected — too much hand-written boilerplate for an FYP team.

**Decision.**
- **ORM.** Drizzle ORM. Schema files live under `src/db/schema/` (split by domain: `auth.ts`, `rbac.ts`, `profiles.ts`, `departments.ts`). The `index.ts` is a barrel re-export.
- **Migrations.** `drizzle-kit generate` produces SQL into `supabase/migrations/`. Migration runner is the Supabase CLI (`supabase db reset` / `supabase db push`), not `drizzle-kit migrate` — we want a single migration runner across the team and Supabase ships one.
- **RLS.** Authored as **manual SQL** in `supabase/migrations/0001_rls_policies.sql` (and follow-on numbered files for feature tables). The drizzle-kit journal does not track these files — they are still applied by Supabase's runner because they live alongside the generated SQL in `supabase/migrations/` and are picked up alphabetically.
- **Auth.js adapter.** `@auth/drizzle-adapter` (Postgres dialect). We override the default table definitions to use `uuid` IDs with `gen_random_uuid()` and to add `created_at` / `updated_at` to `users` while keeping every column name the adapter expects.

**Consequences.**
- Type safety end-to-end: server actions read Drizzle's inferred row types from `src/db/types.ts`.
- Schema diffs are reviewable as plain SQL in the migration files.
- RLS policies are auditable as plain SQL — important for the thesis appendix and for examiner review.
- The Drizzle journal (`supabase/migrations/meta/_journal.json`) tracks only the generated migrations; manual RLS SQL is intentionally outside it. Drift between the Drizzle schema and the manual SQL is detected by `drizzle-kit check` (in CI).
- Folder structure deviation from the spec: [`folder-structure-spec.md`](../03-design/folder-structure-spec.md) shows `src/db/schema.ts` as a single file. PR #24 splits the schema into `src/db/schema/{auth,rbac,profiles,departments}.ts` to keep each domain reviewable in isolation. The spec doc will be updated to reflect this in a follow-up docs PR; the alias `import from "@/db/schema"` resolves to the directory's `index.ts` so consumer code is unaffected.
- IC numbers stored as `bytea` via `pgcrypto.pgp_sym_encrypt` (ADR-008). The encryption key is read from `IC_ENCRYPTION_KEY`; rotation is a re-encryption job (not in scope for PR #24).
- The first migration `0000_auth_rbac_profiles.sql` enables `pgcrypto`. The future `vector` and `btree_gist` extensions are explicitly out of scope; they ship with the embedding-table and event-table PRs respectively.

**References.**
- `src/db/schema/`, `drizzle.config.ts`, `supabase/migrations/0000_auth_rbac_profiles.sql`, `supabase/migrations/0001_rls_policies.sql`.
- [`../03-design/database-schema.sql.md`](../03-design/database-schema.sql.md), [`../03-design/rls-policy-design.md`](../03-design/rls-policy-design.md).
- [ADR-002](#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth), [ADR-003](#adr-003--database-sessions-not-jwt), [ADR-008](#adr-008--pdpa-2010-aligned-design-from-day-1).

---

## ADR-017 — Pin `next-auth@5.0.0-beta.30`, `postgres` (postgres.js) driver, and Resend for magic-link delivery

**Status.** Accepted.

**Date.** 2026-05-06.

**Context.**
PR #25 implements the Auth.js v5 magic-link login + Drizzle adapter wiring laid out in [`../05-tech-spikes/spike-authjs-v5-app-router.md`](../05-tech-spikes/spike-authjs-v5-app-router.md). Three concrete dependency choices need a permanent record so future contributors do not regress them: the exact next-auth beta pin, the Postgres driver, and the magic-link delivery vendor. Each was either left implicit by [ADR-003](#adr-003--database-sessions-not-jwt) or under-specified in earlier ADRs.

**Options.**

- *next-auth pin.* Float on `^5.0.0-beta.x` (current) versus pin to an exact beta build (`5.0.0-beta.30`).
- *Postgres driver.* `postgres` (postgres.js) versus `pg` (node-postgres).
- *Magic-link vendor.* Resend versus AWS SES (sandbox), Supabase Auth Email, or Nodemailer + school SMTP.

**Decision.**

1. Pin `next-auth` to the exact build `5.0.0-beta.30`. The v5 beta API has shifted in the past between betas (provider option keys, `proxy` vs middleware export shape); a floating range plus `npm ci` in CI would drift.
2. Use `postgres` (postgres.js) via Drizzle's `drizzle-orm/postgres-js` import. Lower cold-start cost on serverless, matches the Supabase Transaction Pooler URL format, and the seed script in PR #24 already uses it. `prepare: false` is required by PgBouncer on port 6543.
3. Use Resend for magic-link delivery. Free tier 100/day / 3,000/month is comfortably above the FYP demo envelope; `next-auth/providers/resend` is a first-party Auth.js provider; one API key, one DNS verification step, no recipient pre-verification (which AWS SES sandbox would force on every parent address). Local development falls back to a `console.log` of the magic-link URL when `AUTH_RESEND_KEY` is unset, so sign-in works against a fresh checkout with no inbox configuration.

**Consequences.**

- `package.json` records `"next-auth": "5.0.0-beta.30"` (no caret). Bumping requires a deliberate edit + a re-run of the auth integration test.
- `src/lib/db/index.ts` instantiates `postgres(connectionString, { prepare: false, max: 10 })` and Drizzle wraps it via `drizzle-orm/postgres-js`. `pg` and `drizzle-orm/node-postgres` are not used.
- `src/lib/auth/send-magic-link.ts` is the sole place the Resend SDK is constructed; the `Resend` provider's `sendVerificationRequest` delegates to it. Production sends bilingual BM-first emails; development logs to stdout when `AUTH_RESEND_KEY` is empty.
- `.env.example` adds `AUTH_RESEND_KEY` and `AUTH_EMAIL_FROM` placeholders alongside `AUTH_SECRET` / `AUTH_URL`. Production rollout requires verifying the school domain in Resend and rotating the key into the environment.
- The free tier ToS allow Resend to log message metadata. Acceptable because magic-link payloads are single-use 24-hour tokens and contain no PII beyond the recipient address.
- If Auth.js v5 reaches GA before FYP2 implementation, supersede this ADR with a new one that re-pins to the GA range and documents migration steps.

**References.**

- [`../05-tech-spikes/spike-authjs-v5-app-router.md`](../05-tech-spikes/spike-authjs-v5-app-router.md) — pinned versions table, §0.4 driver choice, §2 vendor comparison.
- [`../03-design/auth-and-session-design.md`](../03-design/auth-and-session-design.md) — wired-up shape after PR #25.
- [ADR-002](#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth), [ADR-003](#adr-003--database-sessions-not-jwt), [ADR-009](#adr-009--rag-audience-admin-teacher-parent-student-excluded-in-v1), [ADR-011](#adr-011--admin-only-parentstudent-linking-with-csv-bulk--per-family-edits), [ADR-012](#adr-012--use-proxyts-not-middlewarets-on-the-nodejs-runtime-for-session-refresh-and-auth-gating), [ADR-013](#adr-013--nest-pages-under-a-role-named-segment-inside-each-roles-parenthesised-route-group), [ADR-016](#adr-016--drizzle-orm-as-the-schema-source-of-truth-drizzle-kit-for-generation-manual-sql-for-rls).

---

## ADR-018 — Replace Auth.js v5 with Supabase Auth for identity and sessions

**Status.** Proposed.

**Date.** 2026-06-21.

**Context.**
The 2026-06-20 stakeholder meeting directed the project to drop Auth.js and adopt Supabase's native authentication ("it handles the role for us, like Cognito"). This realigns the build with the project's own source documents, which the Auth.js choice had quietly diverged from: the thesis Ch 3 states *"Supabase also provides its own authentication service known as Supabase Auth ... RLS is combined with Supabase Auth to enable end-to-end security from the browser to the database"* and the Ch 4 ERD describes *"PROFILES connected to Supabase Auth's auth_users"*; the SRS lists *"Login with Google"* (UC01 AF1) and a Design Constraint that the system *"uses Supabase to hash and secure"* credentials. Auth.js v5 shipped in PR #25 ([ADR-016](#adr-016--drizzle-orm-as-the-schema-source-of-truth-drizzle-kit-for-generation-manual-sql-for-rls), [ADR-017](#adr-017--pin-next-auth500-beta30-postgres-postgresjs-driver-and-resend-for-magic-link-delivery)) but was never named by the thesis or SRS. Note ADR-002/003 are status `Proposed` (revisable in place); ADR-016/017 are `Accepted` (must be superseded).

**Options.**
1. Keep Auth.js v5 (status quo). Contradicts the thesis + SRS and keeps a churning beta dependency (`next-auth@5.0.0-beta.x`, risk R-03).
2. Supabase Auth via `@supabase/ssr`. Identity in the managed `auth.users` schema; the app keeps a `public.profiles` row FK'd 1:1 to `auth.uid()`; magic-link/OTP and Google OAuth handled by Supabase; cookie/session handled by `@supabase/ssr` in `proxy.ts`.
3. Hybrid (Auth.js for the app, Supabase only for the database). Rejected — two session systems, the worst of both.

**Decision.**
Option 2 — Supabase Auth is the identity and session provider. Supersedes ADR-017; revises ADR-002, ADR-012, ADR-016; the enforcement and revocation model is decided separately in [ADR-019](#adr-019--enforcement-and-revocation-under-supabase-auth). Reopens P0-Q6.

**Consequences.**
- `@supabase/ssr` is added (not currently installed); `@supabase/supabase-js` (already a dependency, currently unused) becomes load-bearing; `next-auth` and `@auth/drizzle-adapter` are removed.
- Identity moves to Supabase-managed `auth.users`. The app keeps `public.profiles` FK'd 1:1 to `auth.users.id` (uuid), provisioned by an `on auth.users insert` trigger. **The existing uuid PK is reused**, so every downstream FK (`user_role.user_id`, `*_profile.user_id`, `family_link`, `parent_verification_request.user_id`) survives without a data migration. The Auth.js adapter tables (`accounts`, `sessions`, `verification_token`, `authenticators`) are dropped from the app schema.
- **Drizzle survives** as ORM + migration generator ([ADR-016](#adr-016--drizzle-orm-as-the-schema-source-of-truth-drizzle-kit-for-generation-manual-sql-for-rls)); only its `@auth/drizzle-adapter` clause and adapter-table overrides are dropped.
- The RBAC engine (`roles`, `permissions`, `role_permission`, `user_role` tables; the permission catalogue; `hasPermission`) is auth-vendor-agnostic and **does not change**. This corrects the stakeholder belief: Supabase Auth (like Cognito groups) gives authentication, JWT issuance, magic-link/OTP, OAuth, and a place to attach claims — it does **not** ship an RBAC matrix, a permission catalogue, scoped permissions, or the [ADR-011](#adr-011--admin-only-parentstudent-linking-with-csv-bulk--per-family-edits) parent-verify flow, all of which remain hand-built.
- Magic-link/OTP delivery moves to Supabase Auth. Resend may be retained as Supabase's **custom SMTP sender** to preserve BM-first bilingual branding.
- PR #25 auth code is superseded: `src/lib/auth.ts`, `src/types/next-auth.d.ts`, `src/app/api/auth/[...nextauth]/route.ts`, and the `proxy.ts` body are replaced. `src/lib/rbac.ts` + `session-context.ts` keep their function signatures (`getCurrentUser` / `requireUser` / `hasPermission` / `requirePermission`) and only swap internals to read the Supabase session — confining churn to ~5 lib files rather than the ~48 consumers. Migration `0000` is superseded for the adapter tables.
- PDPA ([ADR-008](#adr-008--pdpa-2010-aligned-design-from-day-1)): identity PII now lives in Supabase `auth.users`; the DSAR delete/export path and DPO data map must include it (deletion cascades across `auth.users` via the Supabase admin API **and** the app tables).
- A new spike (`spike-supabase-auth-ssr-app-router.md`) is required before the migration PR; it supersedes `spike-authjs-v5-app-router.md`.

**References.**
- [`../source-docs/thesis.md`](../../source-docs/thesis.md) Ch 3 (Backend Development), Ch 4 (Database Design ERD); [`../source-docs/srs.md`](../../source-docs/srs.md) UC01, Design Constraints.
- [`log-book.md`](./log-book.md) 2026-06-20 entry; [`auth-and-session-design.md`](../03-design/auth-and-session-design.md).
- Supersedes [ADR-017](#adr-017--pin-next-auth500-beta30-postgres-postgresjs-driver-and-resend-for-magic-link-delivery); revises [ADR-002](#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth), [ADR-012](#adr-012--use-proxyts-not-middlewarets-on-the-nodejs-runtime-for-session-refresh-and-auth-gating), [ADR-016](#adr-016--drizzle-orm-as-the-schema-source-of-truth-drizzle-kit-for-generation-manual-sql-for-rls); see [ADR-019](#adr-019--enforcement-and-revocation-under-supabase-auth).

---

## ADR-019 — Enforcement and revocation under Supabase Auth

**Status.** Proposed.

**Date.** 2026-06-21.

**Context.**
[ADR-018](#adr-018--replace-authjs-v5-with-supabase-auth-for-identity-and-sessions) adopts Supabase Auth, which is JWT-based (access token + refresh token). This collides with [ADR-003](#adr-003--database-sessions-not-jwt) (database sessions, chosen for **instant** revocation) and forces three rulings: (a) where role/permission resolution happens, (b) how a revoked role propagates without DB sessions, and (c) whether the app connects through the **service-role key** (RLS bypassed — today's model, per `rls-policy-design.md` notes 2–3) or the **authenticated/anon key** (RLS live). ADR-002 and ADR-003 are status `Proposed`, so they are revised in place here. A critical correction: adopting Supabase Auth does **not** by itself "light up" the already-authored RLS — the policies in `0001_rls_policies.sql` are bypassed because the app connects via the service-role key, and they stay bypassed until the connection strategy itself changes.

**Options (enforcement point).**
1. RLS-primary: connect with the authenticated key; JWT claims drive RLS as the gate. Rejected for v1 — bundles a connection-strategy reversal that breaks the current public-news/Takwim serving model (served via service-role with **no** `anon` policy) and would re-architect every public and authenticated read.
2. App-layer-primary (reaffirm [ADR-002](#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth)): server-side `hasPermission` per request against the DB tables; a Supabase **custom access-token hook** injects a *lightweight* claim set so RLS becomes correct (a live defense-in-depth net) for any future authenticated-key path.
3. Claims-only: put the full permission set in the JWT. Rejected — the 38-code catalogue bloats the token and every permission change needs a token re-mint.

**Options (revocation).**
1. Accept up-to-TTL staleness everywhere. Rejected — discards ADR-003's intent.
2. Short access-token TTL + per-request app-layer resolution. Chosen.

**Decision.**
Enforcement: Option 2 — **app layer stays the source of truth ([ADR-002](#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth) stands)**. A custom access-token hook (Postgres function `public.add_rbac_claims`) injects role codes + status + dept ids into the JWT `app_metadata`. The app **keeps the service-role connection for v1**; the authenticated-key + RLS-primary migration is explicitly **deferred to v2**.
Revocation: Option 2 — a short access-token TTL (target 5–15 min) plus per-request permission resolution from the DB tables (which an admin role change updates immediately), and a Supabase admin session-revoke call on role change to drop refresh tokens.

**Consequences.**
- Revises [ADR-003](#adr-003--database-sessions-not-jwt): the database-session *mechanism* is replaced, but its instant-revocation *intent* is preserved — app-layer-gated routes revoke effectively instantly (the next request re-resolves permissions), and only claim-based RLS checks are bounded by the token TTL. The "delete `sessions` WHERE userId" rule becomes "call the Supabase admin session-revoke + rely on per-request resolution".
- Revises [ADR-002](#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth): reaffirmed app-layer-primary, and adds the JWT-claim-shape contract (`role_codes`, `status`, `dept_ids` in `app_metadata`). `0001_rls_policies.sql` needs **no SQL change** and becomes correct (it resolves real `auth.uid()`/`auth.jwt()` values) — but only *enforces* on the authenticated-key path, which v1 does not use. Do not claim "RLS is now live" until the v2 connection migration lands.
- The PENDING_VERIFICATION status ([ADR-011](#adr-011--admin-only-parentstudent-linking-with-csv-bulk--per-family-edits)) moves from the Auth.js session callback into the claims hook (status rides the JWT) or is resolved server-side per request.
- Adds a **revocation-propagation-latency NFR** to master-plan §11.3: `<= access-token TTL` for any claim-based path, effectively immediate for app-layer-gated paths — replacing the lost "instant" guarantee.
- The `spike-supabase-auth-ssr-app-router.md` spike must prove the claims hook, the short-TTL refresh-in-`proxy.ts` flow, and the role-change revoke on Next.js 16 (Node runtime).

**References.**
- `rls-policy-design.md` notes 2–3 (service-role bypass; public reads served via service-role with no `anon` policy).
- Revises [ADR-002](#adr-002--application-layer-is-the-source-of-truth-for-rbac-supabase-rls-mirrors-as-defense-in-depth), [ADR-003](#adr-003--database-sessions-not-jwt); depends on [ADR-018](#adr-018--replace-authjs-v5-with-supabase-auth-for-identity-and-sessions); reopens P0-Q6.

---

## ADR-020 — Agentic AI assistant: three grounded modes (in-article context, news function-calling, manual RAG)

**Status.** Proposed.

**Date.** 2026-06-21.

**Context.**
The AI subsystem (FR-AI-*, ADR-001) was originally specced as a single document-RAG pipeline: chunk every school document, embed the chunks, retrieve by similarity under a per-document ACL, and generate a grounded answer (thesis FR09; SRS UC16/UC08 describe a chatbot that answers from school DOCUMENTS for "All Users"; master-plan 11.5 locks the chunk/embed/MMR/BM25-RRF/τ_refuse/golden-100/RAGAS design for exactly this). The 2026-06-20 stakeholder re-baseline narrowed and re-shaped that surface. The school's real near-term need is two cheap, retrieval-free conversational affordances over news -- answering questions about the article a user is reading, and letting the assistant pull news on demand -- plus a small "how do I use this portal" helper. None of those requires embedding the whole document corpus, and the original single-pipeline framing forces every one of them through pgvector and HNSW machinery that is over-built for the actual data volume. The packages this needs (`ai@^6.0.175`, `@ai-sdk/google@^3.0.67`) are already in `package.json` from the Vercel AI SDK spike, so the gating work is a design re-scope plus a pgvector spike against a tiny corpus -- not a dependency install. This ADR records the re-shaped AI design as three distinct, separately-grounded modes; it narrows ADR-005/006/007 and revises the ADR-009 audience ruling. It does not re-author master-plan 11.5 -- it re-scopes which mode 11.5 governs.

**Options.**

1. **Keep the single document-RAG pipeline (status quo / thesis FR09).** One ingestion + embedding + retrieval path over all school documents; every AI affordance is a RAG query. Rejected for v1 -- it forces news-reading and news-fetching (which need no retrieval) through pgvector, requires the full per-document ACL ingestion pipeline before any AI feature can ship, and embeds a corpus the school is not ready to hand over (the real documents only land post paid-tier + consents, ADR-007/008). It also mis-sizes the index: the actual v1 grounding data is news rows (already in `0002_news_memo_audit`) and one short manual, not 100k document chunks.

2. **Three grounded modes, each with its own grounding mechanism (chosen).**
   - **Mode 1 -- in-article context.** The assistant is grounded ONLY by the text of the news article the user currently has open. The article body is stuffed into the prompt as context; there is NO retrieval and NO embedding. Answers a "explain/summarise this article" question against a single known source.
   - **Mode 2 -- agentic news fetch.** A `get_news` function/tool (Vercel AI SDK tool-calling) lets the model fetch news rows from the database mid-turn and ground its answer on what it pulled. NO embedding. The tool resolves news by structured filters (recency, department, keyword), not by vector similarity.
   - **Mode 3 -- manual RAG.** The ONLY true RAG mode. A single "how-to-use-this-system" manual (which does not exist yet and must be authored) is chunked and embedded; a manual query retrieves the relevant section and the model answers grounded on it, returning the grounded text PLUS any image links carried as section metadata (screenshots of the portal).

3. **Two modes only (drop Mode 1, fold "read this article" into Mode 2's tool).** Rejected -- when the user is already looking at a specific article, stuffing its known text is strictly cheaper and more faithful than a tool round-trip that re-fetches it; collapsing the two loses the "no extra LLM call, no retrieval" property of Mode 1 and inflates token cost for the most common interaction.

**Decision.**
Option 2 -- the AI assistant ships as three separately-grounded modes (in-article context-stuffing; agentic `get_news` tool-calling; manual RAG), reusing `gemini-2.5-flash` for generation across all three. Master-plan 11.5's document-RAG pipeline applies to **Mode 3 only**. This narrows ADR-005 and ADR-006, re-derives the ADR-007 quota budget, and revises the ADR-009 audience. Reopens P0-Q3 and P0-Q4.

**Consequences.**

- **Narrows ADR-005 (pgvector store).** The vector corpus shrinks from the projected <=100k school-document chunks to the tens-of-chunks of a single manual. pgvector inside Supabase still stands, but the HNSW index `m=16, ef_construction=64` is now over-sized: at tens of chunks, a flat exact scan (sequential cosine over the whole table) is faster and simpler than an approximate index and removes the index-build/tuning step entirely. Record the HNSW parameters as deferred to the v2 document-RAG corpus; v1 Mode 3 uses a flat scan with no HNSW index.
- **Narrows ADR-006 (embeddings).** Only the manual is embedded. The image links returned by Mode 3 are section METADATA attached to a chunk, not pixels the embedder ever sees -- so the text-only `gemini-embedding-001` (1536-d, ADR-006) is sufficient and the multimodal `gemini-embedding-2-preview` flagged in ADR-006 is NOT needed for this. The `embedding` table and `vector(1536)` column are unchanged; only the corpus they hold changes.
- **Re-derives ADR-007 cost/quota; re-rates R-11.** ADR-007's free-tier budget (1,500 req/day, 1M TPM, 20 req/min) was sized assuming one LLM call per RAG turn. Two of the three modes break that assumption: Mode 2 tool-calling is 2+ LLM round-trips per user turn (the call that decides to invoke `get_news`, then the call that answers from the tool result -- more if the model chains fetches), and Mode 1 context-stuffing inflates input tokens (the full article rides in every turn) and pushes against the 1M TPM ceiling faster than a 4-chunk RAG context did. The per-turn request multiplier and token inflation must be recomputed and risk R-11 (free-tier 1,500 req/day cap during UAT) re-rated upward before UAT; the 20-req/min per-user limit is now per-user-turn, so a single Mode 2 turn can consume multiple request units. This is a design note for the re-derivation, not a vendor change -- ADR-007's `gemini-2.5-flash` choice (which supports tool-calling) stands and is reused for all three modes.
- **Revises ADR-009 (RAG audience).** ADR-009 excluded Student from `rag:query` to keep under-13 students away from the LLM (preserving the ADR-008 minor-LLM guard). Modes 1 and 2 ground on NEWS, and news can carry a PUBLIC visibility tier (ADR-010) -- so an article-reading surface or a news-fetch tool reachable by an anonymous or Student user would let exactly the cohort ADR-009 fenced out initiate an AI turn. RECOMMENDATION (Proposed, for stakeholder sign-off at P0 re-lock): **initiating an AI turn in any mode requires an authenticated, non-Student account in v1**; reading inherits the article's own visibility (a Parent may ask about any article they can already see). Student and anonymous AI access stay a v2 item pending the same PDPA review of student-LLM interaction that ADR-009 deferred. This keeps the ADR-008 guard intact even though the grounding source moved from ACL'd documents to public-tier news.
- **Re-scopes master-plan 11.5.** The locked document-RAG design (hybrid chunking, top-k=8 -> MMR-4, BM25 + cosine via RRF, `τ_refuse`, golden 100, RAGAS, per-document `acl_key` pre-filter) governs **Mode 3 only**. Modes 1 and 2 do no retrieval and therefore have no MMR/BM25/RRF/τ_refuse/ACL-pre-filter step; their grounding correctness is enforced differently (below). Master-plan 11.5 must be annotated to scope its pipeline to Mode 3; a follow-up docs edit re-titles it accordingly.
- **Evaluation splits per mode.** Mode 3 keeps RAGAS (faithfulness >= 0.85, answer relevancy >= 0.80, context precision >= 0.70) over a manual-scoped golden set. Mode 2 is evaluated by **tool-call correctness** (did the model invoke `get_news` with the right filters, and did it ground only on returned rows). Mode 1 is evaluated by **answer-grounding** (does the answer stay within the single open article, no outside facts). The golden 100 (P0-Q11, deferred) is re-scoped to Mode 3's manual + a small per-mode eval set for Modes 1/2.
- **SECURITY -- Mode 2 caller-scoped fetch.** `get_news` MUST filter to news visible to the CALLER under the ADR-010 taxonomy. A naive "fetch all news" implementation taken literally would let the model surface `internal`- or `role_list`-scoped news to a caller who may not see it, leaking it through the assistant. The model is grounded by everything the caller is permitted to see, never the whole `news` table. The tool runs the same visibility predicate the news read path uses (visibility = public, OR internal for any authenticated user, OR the caller's role code is in `visible_role_codes`); the AI layer is NOT a privilege-escalation bypass around ADR-010. This is the AI analogue of the RAG RBAC pre-filter (master-plan 11.5) and must be covered by a cross-visibility attack test (R-04).
- **Open dependency -- the manual must be authored.** Mode 3 cannot ship until a "how-to-use-this-system" manual exists. Owner and timeline are unassigned; flag as a P0-Q4 follow-up (alongside the document-ACL question this ADR reopens). Until the manual exists, Mode 3 is design-complete but not implementable; Modes 1 and 2 are unblocked because their grounding data (news rows) already exists.
- **Open dependency -- image storage undecided.** Mode 3 returns image links from the manual; where those images live is NOT decided here. The in-stack candidate is a Supabase Storage public bucket (no new vendor, matches ADR-005's "no new infrastructure" posture), but the image-storage ruling is its own follow-up decision and is deliberately left open in this ADR.
- **Packages already present.** `ai@^6.0.175` and `@ai-sdk/google@^3.0.67` are already in `package.json` (Vercel AI SDK spike), so Mode 2 tool-calling and all generation need no install. The gating risk is the pgvector spike against the tiny manual corpus plus authoring the manual -- not a dependency addition. `@supabase/ssr` (ADR-018) is the only outstanding install and is unrelated to the AI modes.
- **Reopens P0-Q3 and P0-Q4.** Q3 (RAG audience) is reopened because the audience model now differs per mode and the Student/anonymous boundary moves to "initiating a turn" rather than a flat `rag:query` deny. Q4 (document ACL granularity) is reopened because v1 no longer ingests school documents at all -- the per-document ACL is now a v2 concern, while the v1 ACL surface that matters is news visibility (ADR-010) enforced inside `get_news`.

**References.**
- `../../source-docs/thesis.md` FR09 (chatbot answers from school documents) and `../../source-docs/srs.md` UC16 / UC08 ("All Users" document-RAG) -- the OLD single-pipeline model these three modes diverge from.
- master-plan 11.5 (RAG pipeline locked design) -- now scoped to Mode 3 only.
- ADR-005 (pgvector store; HNSW now over-sized for a tens-of-chunks corpus), ADR-006 (Gemini embeddings; text-only model sufficient, image links are metadata), ADR-007 (`gemini-2.5-flash`; quota re-derived for multi-round-trip tool-calling and context-stuffing), ADR-009 (RAG audience; revised so initiating a turn requires an authenticated non-Student account), ADR-010 (visibility taxonomy enforced by `get_news`), ADR-008 (under-13 minor-LLM guard preserved).
- `../01-overview/p0-decisions-to-lock.md` Q3, Q4 (reopened); Q11 golden-100 ownership (re-scoped per mode).
- R-04 (RBAC/RLS drift attack tests), R-11 (free-tier quota cap) in master-plan §8.

---

## ADR-021 — News engagement: likes and threaded parent-question/teacher-answer comments with inherited visibility and minor-safe moderation

**Status.** Proposed.

**Date.** 2026-06-21.

**Context.**
The thesis Problem Background documents that SRIAAWP currently fields parent questions through a Telegram broadcast channel, where announcements and the parent replies they provoke interleave into a single undifferentiated stream; staff lose track of which question belongs to which announcement, and parents lose answers in the scroll. The portal already ships the `news` table and its visibility taxonomy (migrations 0002/0003, ADR-010) but offers parents no way to respond to a news item in context, and gives staff no structured place to answer. The result is that the very overload the portal was meant to relieve continues to live in Telegram. This ADR adds a first-class engagement surface anchored to each news item -- a like signal plus a one-level parent-question / teacher-answer thread with closed-loop notification -- so the support conversation moves out of the broadcast channel and onto the announcement it concerns. The forces in tension are: visibility correctness (a comment on an `internal` news item must never leak to anonymous or wrong-role readers), child-safety caution (students are minors; user-generated content authored by or shown to minors raises a duty of care the RAG audience decision already flagged), and PDPA obligations on the resulting user-generated personal data (ADR-008). The shipped visibility logic in `src/lib/content/queries.ts` (`listVisibleNews` / `getVisibleNewsBySlug`) is the canonical expression of the ADR-010 scope rules and must be the single source the engagement layer reuses rather than re-deriving.

**Options.**

1. *Engagement rows carry their own visibility column.* Each `news_comment` / `news_reaction` row would store an independent `visibility` enum mirroring ADR-010. Rejected -- it duplicates the parent news item's scope into every child row, invites drift (a news item retracted from `public` to `role_list` would leave orphaned `public` comments readable), and contradicts the single-source-of-truth principle. The parent's scope is the only correct scope; copying it is a bug waiting to happen.

2. *Engagement rows carry no visibility and inherit the parent news item's `{public, internal, role_list}` scope by FK join.* A reader may see a comment or reaction only if they may see the news item it hangs from; the read path subqueries the parent `news` visibility, reusing the `listVisibleNews` logic. One-level threading (`parent_comment_id` self-FK) models exactly the parent-question / teacher-answer loop and nothing more. A separate `notification` table closes the loop so the teacher learns a parent asked and the parent learns a teacher answered. Chosen.

3. *Free-form nested comment tree with multi-reaction types, mentions, and presence.* Rejected for v1 -- arbitrary nesting, emoji reactions beyond a like, @-mentions, and typing/presence indicators are scope creep against a stated problem that needs only a question, an answer, and a notification. These are recorded as MoSCoW Won't and deferred to v2.

4. *Defer engagement entirely; keep parent Q&A in Telegram.* Rejected -- this leaves the documented Telegram overload unaddressed, which is a stated problem the portal exists to solve, not an optional enhancement.

**Decision.**
Option 2. Three new tables are added as a child-engagement slice of the Information Center domain, shipping in their own migration after the live `news` tables (0002/0003):

- **`news_reaction`** -- like-only in v1. Columns: `id uuid PK`, `news_id uuid NOT NULL FK news.id ON DELETE CASCADE`, `user_id uuid NOT NULL FK profiles.id ON DELETE SET NULL`, `reaction_type enum('like') NOT NULL`, `created_at`. Idempotency is enforced by `UNIQUE(news_id, user_id, reaction_type)` so a double-tap is a no-op, not a duplicate. **No `visibility` column** -- the row inherits the parent news scope.
- **`news_comment`** -- one-level threaded. Columns: `id uuid PK`, `news_id uuid NOT NULL FK news.id ON DELETE CASCADE`, `parent_comment_id uuid NULL FK news_comment.id ON DELETE CASCADE` (self-FK; non-null only for a teacher reply to a parent question -- the single permitted level), `author_user_id uuid NULL FK profiles.id ON DELETE SET NULL`, `body text NOT NULL`, `status enum('visible','hidden','deleted') NOT NULL DEFAULT 'visible'` (soft-delete moderation; rows are never hard-deleted by moderation so threads stay intact), `created_at`, `updated_at`. **No `visibility` column** -- inherited as above. A `CHECK` constraint forbids a non-null `parent_comment_id` from itself having a non-null parent, enforcing the one-level rule at the storage tier.
- **`notification`** -- closes the support loop. Columns: `id uuid PK`, `recipient_user_id uuid NOT NULL FK profiles.id ON DELETE CASCADE`, `type enum('news_comment_received','news_comment_answered') NOT NULL`, `resource_type text NOT NULL`, `resource_id uuid NOT NULL` (the `news_comment` that triggered it), `read_at timestamptz NULL`, `created_at`. Without this table the loop never closes: the teacher would not learn a parent asked, and the parent would not learn a teacher answered. Realtime push is a delivery concern decided below; the row is the durable record regardless of transport.

**Visibility inheritance (the key revision of ADR-010).** ADR-010 attached a `{public, internal, role_list}` scope to each *content* row. This ADR rules that *engagement child rows carry no visibility of their own* and inherit the parent news item's scope by FK join. The read path for both `news_comment` and `news_reaction` resolves visibility exactly as `listVisibleNews` / `getVisibleNewsBySlug` do for the parent -- a comment on an `internal` news item is readable only by authenticated users; a comment on a `role_list` item is readable only where the caller's role set overlaps the parent's `visibility_roles`; a comment on a retracted item disappears with it. The RLS policy for `news_comment` and `news_reaction` is therefore a subquery against the parent `news` row's visibility (the SQL mirror of the shipped queries logic), not an independent rule. Consistent with ADR-019, this RLS is *correct-but-bypassed in v1*: the service-role connection bypasses it, so the application layer's reuse of `src/lib/content/queries.ts` is the live enforcement; the RLS becomes enforcing on the v2 authenticated-key path with no SQL change.

**New permission codes.** Six codes are added to `rbac-matrix.md` and the permission catalogue (`src/db/seed/catalogue.ts`), taking it from ~38 to ~44 codes:

| Permission code | Label |
|----------------|-------|
| `news:react` | Add or remove a reaction on a visible news item |
| `news:comment` | Post a comment on a visible news item |
| `news:comment:edit_own` | Edit one's own comment |
| `news:comment:delete_own` | Soft-delete one's own comment |
| `news:comment:moderate` | Hide or delete any comment within scope |
| `news:comment:report` | Report a comment for moderator review |

Proposed role grid (Status `Proposed` -- the Student row needs school sign-off):

| Permission code | Admin | Teacher | Parent | Student |
|----------------|-------|---------|--------|---------|
| `news:react` | Yes | Yes | Yes (ACTIVE only) | Open -- TBD |
| `news:comment` | Yes | Yes | Yes (ACTIVE only) | Proposed No (v1) |
| `news:comment:edit_own` | Yes | Yes | Yes (ACTIVE only) | Proposed No (v1) |
| `news:comment:delete_own` | Yes | Yes | Yes (ACTIVE only) | Proposed No (v1) |
| `news:comment:moderate` | Yes | Yes (own dept) | No | No |
| `news:comment:report` | Yes | Yes | Yes (ACTIVE only) | Open -- TBD |

Grid notes:

- **Parent participation is gated on an ACTIVE account, not on a permission.** A parent in `PENDING_VERIFICATION` (ADR-011) holds `news:comment` / `news:react` but cannot exercise them until an admin approves the account. This is a *precondition* checked at the call site (account status), not a separate permission code -- the same status that gates the rest of the parent surface gates engagement.
- **Teacher moderation is department-scoped** like every other teacher permission: `news:comment:moderate` succeeds only where the teacher's `deptIds` covers the news item's authoring department, consistent with the dept-scope model in `rbac-matrix.md`.
- **Student participation is deliberately OPEN, not auto-inherited from ADR-009.** ADR-009 excluded students from the RAG audience on a PDPA-of-LLM-interaction rationale that does not transfer to commenting; copying that exclusion by reflex would be reasoning by coincidence. The recommendation (Proposed) is that **students are excluded from commenting in v1 pending school sign-off**, on a minor-user-generated-content caution -- letting minors author public-facing text carries a distinct duty-of-care question that the school, not the project, must answer. Student `news:react` is TBD on the same review. This is recorded as a P0 row, not silently decided.

**Moderation is first-class.** The model is post-moderation (comments appear immediately, are reviewed after the fact) plus a report flow plus moderator hide/delete-any:

- A parent or teacher may `news:comment:report` a comment, which raises it for moderator attention; a teacher (own-dept) or admin may then set `status` to `hidden` or `deleted`. Moderators hide/delete *any* comment within scope; authors edit/soft-delete only their *own*.
- Every comment and reaction mutation (create, edit, soft-delete, react, unreact, moderate, report) is **audit-logged through the existing `writeAudit` path** with `resource_type` `'news_comment'` or `'news_reaction'`. The generic `audit_log` shape (`actor_user_id`, `action`, `resource_type`, `resource_id`, `metadata`) already accommodates this; **no audit-schema change is required**.
- All engagement-authored personal data is **DSAR-covered per ADR-008**. On an erasure request, the ruling is to **anonymise rather than cascade-delete**: `author_user_id` / `user_id` are set to NULL (the FK is `ON DELETE SET NULL`) so the thread structure survives and a teacher's answer is not orphaned by the erasure of the parent who asked. Cascade-delete is rejected because removing one participant's rows would silently corrupt the surrounding conversation.
- A **per-user comment rate limit** (analogous to the 20 req/min RAG limit in ADR-007) is applied against spam and accidental double-submission.

**v1 constraint.** The slice is deliberately minimal: like-only reactions, one-level threads, and the notification loop. Multi-reaction types, @-mentions, presence/typing indicators, and arbitrary-depth nesting are MoSCoW **Won't** for v1 and deferred to v2.

**Consequences.**

- Revises ADR-010: the `{public, internal, role_list}` taxonomy now governs *inherited* child-row visibility as well as content-row visibility; engagement rows are explicitly defined to carry no scope of their own and to resolve through the parent news item.
- Reuses, rather than re-implements, the shipped visibility logic: the `news_comment` / `news_reaction` read paths call the same `listVisibleNews` / `getVisibleNewsBySlug` predicate, and the RLS mirror subqueries the parent `news` row. This keeps a single source of truth for ADR-010 scope and prevents the drift Option 1 invited.
- Per ADR-019, the new RLS is correct-but-bypassed in v1 (service-role connection) and becomes enforcing on the v2 authenticated-key path with no SQL change; the application-layer check is the live gate until then. This is an accepted v1 exposure, identical in posture to the rest of the foundation RLS.
- Three new tables and a `news_reaction`/`news_comment`/`notification` migration land downstream of the live 0002/0003 news migrations; the `audit_log` schema is untouched.
- The permission catalogue grows from ~38 to ~44 codes; `rbac-matrix.md` gains a "News engagement" section and an audit-coverage row group for `news_comment` / `news_reaction` actions.
- Realtime delivery of notifications couples to ADR-018: Supabase Realtime is the intended transport so a teacher sees a new parent question and a parent sees the teacher's answer without a manual refresh. This is a flagged dependency, not a hard requirement -- if Realtime is not yet wired, the fallback is poll/revalidate on the notification table, and the durable `notification` row is unaffected by transport choice.
- Negative trade-off accepted: post-moderation means an abusive or off-topic comment is visible until a moderator acts; this is the cost of not blocking every parent question behind pre-approval, and the report flow plus rate limit are the mitigations. Soft-delete (`status`) means hidden/deleted comment bodies persist in storage until a DSAR erasure or retention job removes them -- acceptable because moderation needs an audit trail and PDPA erasure remains available on request.
- Negative trade-off accepted: the Student row is left unresolved, so the engagement UI cannot ship to students until the P0 question is answered. This is preferable to defaulting minors into public commenting without school consent.
- Reopens nothing, but adds a P0 row: *Student participation in news engagement (comment and/or react) and the moderation-response-time expectation the school commits to* -- both require SRIAAWP sign-off before the role grid and moderation SLA can move from Proposed to Accepted.
- This is a NEW feature relative to the SRS and thesis (neither specifies likes or threaded comments), but it is framed as solving a stated problem -- the thesis Problem Background's Telegram parent-Q&A overload -- and is therefore in-scope realignment, not scope creep.

**References.**
- Thesis Problem Background -- the Telegram parent-Q&A / announcement overload this feature replaces (`source-docs/thesis.md`).
- Shipped visibility logic this ADR reuses -- `src/lib/content/queries.ts` (`listVisibleNews`, `getVisibleNewsBySlug`); live migrations `supabase/migrations/0002_news_memo_audit.sql`, `0003_content_rls.sql`.
- `database-schema.sql.md` (Information Center deferred tables), `rls-policy-design.md` (service-role bypass; ADR-019 v1/v2 enforcement split), `rbac-matrix.md` (role grid, dept-scope model, audit coverage).
- Revises ADR-010 (visibility taxonomy). References ADR-008 (PDPA audit logging + DSAR; anonymise-on-erasure), ADR-009 (RAG audience exclusion this ADR deliberately does NOT copy for Student), ADR-011 (PENDING_VERIFICATION vs ACTIVE precondition), ADR-007 (per-user rate-limit precedent), ADR-018 (Supabase Realtime delivery dependency; Supabase Auth identity for `author_user_id`), ADR-019 (correct-but-bypassed RLS, v1 service-role / v2 authenticated-key split).

---

## ADR-022 — Facebook Page integration: direction, scope, and public-only constraint

**Status.** Proposed.

**Date.** 2026-06-21.

**Context.**
The 2026-06-20 stakeholder re-baseline raised a new request not present in any prior artefact: mirror the school's portal announcements onto the school's Facebook Page, framed loosely as "full bidirectional sync — the portal and Facebook stay in step, poll Facebook for new posts." Facebook integration appears nowhere in the thesis or the SRS — the thesis problem statement instead motivates the portal as a consolidation of *scattered* channels (Telegram, ad-hoc chat groups) into one authoritative surface, so an unbounded Facebook bridge works *against* that narrative by re-scattering the source of truth unless it is tightly constrained. This is net-new scope landing late in FYP1, and R-07 (scope creep, probability H) names exactly this class of request. Three forces must be reconciled before any FR is written: (a) Facebook integration is genuinely useful for parent reach and is a reasonable Could-have, so a flat refusal is wrong; (b) the stakeholder's "full bidirectional, poll for posts" framing is technically and legally inaccurate and would, taken literally, commit the FYP to a distributed-systems sync problem plus a cross-border-data-protection problem, neither of which is FYP-sized; (c) the portal already enforces a visibility taxonomy (ADR-010 `{public, internal, role_list}`) and a PDPA-aligned posture (ADR-008) that an outbound bridge can silently violate. A bounded decision is needed now so the request is captured, the constraints are recorded, and the scope-creep trigger is defused rather than left open.

**Options.**
1. **Decline Facebook integration entirely for v1.** Cleanest scope boundary; honours R-07 and the thesis consolidation narrative. Rejected — the request is a legitimate, low-effort *outbound* win (parents already follow the Page) and a flat "no" forfeits real value the stakeholder asked for; the risk is *unbounded* sync, not the feature itself.
2. **Build the stakeholder's literal request: full real-time bidirectional sync, polling Facebook for inbound posts.** Rejected — this is the textbook R-07 scope-creep trigger. It conflates several hard problems the stakeholder framing glosses over: real-time inbound is Meta's *webhook* path (not polling), and webhooks themselves require App Review plus a public callback; outbound posting to a Page requires the `pages_manage_posts` permission, App Review, and the school granting the app Page-admin rights; "bidirectional" introduces loop-prevention and conflict-resolution (a distributed-systems problem with no FYP-sized clean answer); and the dominant blocker is legal, not technical — outbound disclosure of pupil data to Meta is a cross-border transfer to a US processor. Committing FYP2 to this sinks the schedule.
3. **One-way outbound MVP behind an Admin toggle, with inbound deferred and full bidirectional sync explicitly out of scope.** v1 publishes only `visibility = public` portal news to the Page; inbound (Facebook → portal) is a Could-have that, *if* ever built, ingests as an Admin-moderated draft (never auto-publish) via polling, not webhooks; full real-time bidirectional sync is a Won't for v1. Bounds the feature to its high-value, low-risk slice and keeps the source of truth in the portal.

**Decision.**
Option 3, structured as a MoSCoW boundary so the scope line is enforceable at every supervisor review:

- **Must (v1 MVP, FYP2): one-way OUTBOUND only.** A portal news record with `visibility = public` is published to the school's Facebook Page, gated behind an Admin toggle (per-post opt-in, with a global Admin kill-switch). No other portal content type crosses to Facebook in v1.
- **Could (deferred): INBOUND (Facebook → portal).** If built at all, a Facebook Page post is ingested as an **Admin-moderated DRAFT** — never auto-published — via **polling** (Vercel cron or a Supabase scheduled function), **not** webhooks. Inbound is explicitly *not* committed for v1.
- **Won't (v1): full real-time bidirectional sync.** Named here as the R-07 line: any request to "keep them in step both ways in real time" is out of scope and must be re-triaged through the P1/P2 decision queue, not absorbed.

Load-bearing constraints attached to the decision:

- **Public-only outbound guard (narrows ADR-010).** Only `visibility = public` news may ever cross to Facebook. `internal` and `role_list` news must be **hard-excluded** at the outbound boundary — a positive allow-list keyed on `visibility = 'public'`, not a deny-list. A leak of `internal`/`role_list` content to a public Page is simultaneously a confidentiality breach and a PDPA disclosure; this guard is a safety control, not a convenience filter, and is tested with the same cross-scope attack cases R-04 mandates for RLS.
- **Idempotency and loop prevention.** A new table `fb_sync_link` records, per synced item: `portal_news_id` (FK), `fb_object_id`, `direction enum('outbound','inbound')`, `content_hash` (for dedup and edit-detection — re-push only when the hash changes), `sync_status`, `last_synced_at`. The `content_hash` and the link row are what stop a portal post that lands on Facebook from being re-ingested by a future inbound poller (loop prevention). The (deferred) `news` table gains `origin enum('portal','facebook')` and `external_id text`, with a `unique(origin, external_id)` constraint so a Facebook-originated post can be ingested at most once.
- **Reuse existing cross-cutting delivery.** The outbound push reuses the deferred `outbox` and `idempotency` cross-cutting tables (database-schema.sql.md § Deferred tables) for at-least-once delivery and dedup. Do **not** build a parallel delivery mechanism; `fb_sync_link` is the *projection/state* table, `outbox` is the *delivery* mechanism.
- **Secret handling.** The Page access token is a high-value, long-lived credential. It is stored encrypted using the IC-encryption pattern (`pgcrypto` column encryption per ADR-008, key handling per ADR-016) — **not** in plaintext `.env`. Token rotation is a re-encryption job, mirroring the IC-number rotation note in ADR-016.
- **API surface and principal model.** This is a new module (`FR-FB-*`) under a revised ADR-001. The outbound push is a **background job** (driven by the `outbox` worker), not a user-invoked Server Action, and so sits outside the ADR-004 Server-Actions-for-mutations rule by design. The inbound webhook — *if* the Could-have is ever promoted past polling — is a public **Route Handler** with `X-Hub-Signature-256` payload verification, which extends the ADR-004 API-surface taxonomy (a third public Route Handler class alongside RAG SSE and public-cached Takwim). Inbound-created news is written under a synthetic `facebook-sync` **service principal** that holds its own narrow permission (e.g. `news:ingest_draft`) and is subject to app-layer permission checks like any other principal — it does **not** bypass the app layer (ADR-002 reaffirmed).
- **Spike gate.** A spike (`spike-facebook-graph-api.md`) is required before any FR-FB work is committed. It must validate, at minimum: the Graph API publish call with `pages_manage_posts`, the App Review + Business Verification path, the long-lived Page-token exchange and storage, and the realistic effort/feasibility of the school-owned-app dependency below.

PDPA framing (extends ADR-008, recorded as a design constraint, **not** authored as a compliance doc this pass):

- Outbound sync of any news item that **names or photographs an under-13 pupil** is a **cross-border disclosure to a US processor (Meta)**. It requires a **distinct, separately-revocable parental consent** (separate from the portal's own consent) and a **DPIA**, and it carries a hard limitation: **DSAR deletion guarantees cannot be honoured for data already published to Facebook** — once it crosses, the portal can no longer guarantee erasure. Because the FYP operates on **synthetic data only** (ADR-007/ADR-008 posture; no real pupil data is in scope), no PDPA rule is breached during FYP1/FYP2 development, so this is a **recorded design constraint and a production turn-on gate**, *not* an FYP1 blocker. It is stated explicitly here; the consent template and DPIA are deferred to the (currently empty) `08-compliance/` work and are **not** authored by this ADR.

Credential/ownership dependency (the dominant feasibility risk):

- The **school** must own the Meta app, complete **App Review** and **Business Verification**, and grant the app **Page-admin rights**; the student is the *developer* operating against the school's app. This places the critical path partly outside the student's control (Meta's review queue *and* the school's verification effort), which is why outbound MVP is scoped narrowly and gated on the spike — the external dependency, not the code, is what can sink the schedule.

**Consequences.**
- **Scope-widens ADR-008.** A new cross-border-disclosure case (Meta as a US processor), a distinct consent, a DPIA, and a DSAR-erasure limitation are added to the PDPA design surface. Production turn-on of *outbound Facebook sync over real pupil data* becomes an additional gate alongside the existing parental-consent / paid-tier / Surat Kebenaran gates.
- **Scope-narrows ADR-010.** The visibility taxonomy gains a hard external-egress rule: `public` is the *only* scope that may leave the portal to a third-party public surface. `internal` and `role_list` are now explicitly non-egressable to Facebook.
- **New schema obligations (deferred tables).** A new `fb_sync_link` table; `origin` + `external_id` columns and a `unique(origin, external_id)` constraint on the deferred `news` table; reuse (not duplication) of `outbox` + `idempotency`. All land with the FR-DM/FR-IC deferred-table work, not with PR #24.
- **New module and FR prefix.** `FR-FB-*` under a revised ADR-001 module decomposition; the outbound job, the (deferred) inbound Route Handler, and the `facebook-sync` service principal are specified in the FR-FB requirements once written.
- **Negative trade-offs accepted.** (a) The Admin gets a per-post manual toggle rather than blanket auto-publish — chosen deliberately so the public-only guard is a *human-confirmed* action, at the cost of convenience. (b) Inbound is a Could-have with no committed delivery date; the school may perceive the v1 MVP as one-directional and less than the "both ways" they asked for. (c) The whole feature is gated on an external party (Meta + the school) completing App Review and Business Verification, so it may not ship in FYP2 at all if that dependency stalls — and that is the correct failure mode for an FYP, far better than committing to bidirectional sync that cannot be finished or legally turned on.
- **Corrects the stakeholder framing on record.** "Full bidirectional, poll for posts" is inaccurate and is replaced by: webhooks (not polling) are Meta's real-time inbound path but also need App Review and a public callback; posting to a Page needs `pages_manage_posts` + App Review + the school's Page-admin grant; "bidirectional" needs loop-prevention + conflict resolution (a distributed-systems problem, not a feature toggle); and the cross-border-disclosure legal blocker is larger than the entire API integration.
- **Risk register updates (append rows):**
  - **R-13 — Meta App Review / Business Verification external blocker.** Category External dependency. Probability M, **Impact H**. Mitigation: school owns the Meta app and starts Business Verification early; outbound MVP scoped to a single Page-post call to minimise the review surface; feature gated on `spike-facebook-graph-api.md`; FYP2 plan treats Facebook sync as a *Could* so a stalled review does not block the core deliverable.
  - **R-14 — Bidirectional loop / duplicate posting.** Category Tech. Probability M, Impact M. Mitigation: `fb_sync_link` + `content_hash` dedup + `unique(origin, external_id)`; inbound (if ever) is poll-only and ingests as draft; full bidirectional sync is an explicit Won't (v1).
  - **R-15 — Content-model mismatch (portal news ↔ Facebook post).** Category Tech. Probability M, Impact M. Mitigation: outbound maps a defined subset (title, body excerpt, canonical portal link, primary image) only; `content_hash` covers the synced subset; rich portal-only fields (visibility, role lists, attachments) are never serialised outbound.
  - **R-16 — Scope-creep into full bidirectional Facebook sync (R-07 materialising).** Category Scope. Probability H, Impact M. Mitigation: this ADR's MoSCoW Won't-line; every "make it two-way / real-time" request routed through the P1/P2 decision queue at the supervisor meeting, never absorbed silently. Cross-linked to R-07.

**References.**
- Revises ADR-001 (new FR-FB-* module); reaffirms ADR-002 (`facebook-sync` service principal does not bypass the app layer); extends ADR-004 (inbound webhook as a third public Route Handler class with `X-Hub-Signature-256` verification; outbound as a background job, not a Server Action); scope-widens ADR-008 (cross-border disclosure, distinct consent, DPIA, DSAR-erasure limitation); scope-narrows ADR-010 (public-only external egress); secret handling per ADR-008 / ADR-016.
- database-schema.sql.md § Deferred tables — `news`, `outbox`, `idempotency` (reused, not duplicated); new `fb_sync_link`.
- risk-register.md — R-07 (scope creep), R-04 (RBAC/RLS leak attack cases reused for the public-only guard); new rows R-13..R-16.
- spike-facebook-graph-api.md — required before any FR-FB work (Graph API publish with `pages_manage_posts`, App Review + Business Verification path, long-lived Page-token exchange and encrypted storage, school-owned-app feasibility).
- Source-of-truth note: Facebook integration is absent from thesis.md and srs.md; the thesis problem statement motivates the portal as a *consolidation* of scattered channels (e.g. Telegram), so an unbounded Facebook bridge works against that narrative unless bounded as above.

---

## ADR-023 — Revised MoSCoW scope baseline after the 2026-06-20 stakeholder meeting

**Status.** Proposed

**Date.** 2026-06-21.

**Context.**
The signed proposal (PP.md, PSM1.PF.05, supervisor-signed 16.4.26) and proposal deck (PS.md, 30 slides) define a four-module portal — User Management (UM), Department Management (DM), Information Dashboard (IC, incl. news/memo/Takwim and the conflict-checker), Co-curricular Record (CR) — plus a RAG document chatbot and a conflict-free calendar. The 2026-06-20 stakeholder re-baseline introduced four changes the orchestrator has captured as decisions C1-C4: C1 migrates authentication from Auth.js v5 to Supabase Auth (ADR-018, ADR-019); C2 reshapes the AI surface from "RAG over all school documents for all users" into a three-mode agentic design (in-article context, get_news function-calling, and a gated manual-RAG mode); C3 adds Facebook integration for public news distribution; C4 adds social-style engagement (likes and parent-question/teacher-answer comment threads) to public articles. Two of these — C3 (Facebook) and C4 (social engagement) — appear nowhere in the signed PP/PS or in any prior ADR (ADR-001..022). They are therefore a genuine addition to scope, not a silent reinterpretation of already-agreed work, and the proposal-versus-delivered gap must be made auditable on examiner day, where the examiner will hold the delivered system against the signed PP/PS. The corresponding `moscow-scope.md` referenced by the Master Plan (§4 folder structure, §5 WS-A) and by `scope-pillars.md` has not yet been written, so there is no existing MoSCoW baseline to amend — this ADR establishes it. Timing is favourable: gate G2 (requirements freeze, week 7) and gate G3 (design freeze, week 11) have not passed, most of `02-requirements/` and `03-design/` is unwritten, and the original P0 (locked 2026-05-05) carries only the student's signature — the supervisor and Pengetua countersignature rows are blank and the Surat Kebenaran is still pending — so absorbing the change through a fresh baseline plus re-sign is procedurally cleaner than re-opening a countersigned document.

**Options.**
1. **Silently absorb C1-C4 into the requirements without a formal re-baseline.** Treat the four changes as ordinary requirement evolution and let them appear in `functional-requirements.md` when written. Rejected: C3 and C4 are not traceable to PP/PS or any ADR, so on examiner day the delivered system would carry features the signed proposal never authorised, with no audit trail explaining the divergence — exactly the proposal-versus-delivered gap an examiner probes, and exactly the scope creep R-07 warns against if left ungoverned.
2. **Defer C3 and C4 entirely and deliver only the signed PP/PS scope plus C1/C2.** Keep the baseline identical to the proposal. Rejected: C2's mode-3 RAG already diverges from the PP/PS "RAG over all documents for all users" promise (thesis FR09, SRS UC16/UC08), so the proposal-versus-delivered gap exists regardless; and the stakeholder has asked for C3/C4. Refusing them without recording the request loses stakeholder intent and forces the same decision later under worse timing (post-G3).
3. **Re-baseline the whole project as a single Must/Should/Could/Won't table now, tier every item (original scope + C1-C4), and tie acceptance of the new baseline to a fresh supervisor + Pengetua re-sign that supersedes the student-only P0.** Author `moscow-scope.md` as the source of truth, mark C3/C4 explicitly as additions beyond the signed PP/PS, and record the divergences (C2 mode-3, Student AI exclusion) so the examiner-day gap is documented rather than discovered. Accepted: it makes the change governable, auditable, and procedurally clean while G2/G3 are still open.

**Decision.**
Adopt Option 3: establish a single revised MoSCoW baseline for the whole project in `moscow-scope.md`, tiering the original four modules and changes C1-C4, and gate its acceptance on a fresh supervisor + Pengetua re-sign that supersedes the 2026-05-05 student-only P0.

**Consequences.**
- `moscow-scope.md` becomes the single source of truth for in/out-of-scope decisions, consumed by `functional-requirements.md`, `use-case-spec.md`, `scope-pillars.md`, and `objectives-traceability.md`; every FR must trace to a Must/Should/Could tier or be rejected.
- The proposal-versus-delivered gap is made explicit and auditable: C3 (Facebook) and C4 (social engagement) are recorded as additions beyond the signed PP/PS, and C2's mode-3 divergence from the PP/PS "RAG for all users" promise is documented rather than left for the examiner to find.
- Acceptance is blocked on a re-sign ceremony: because the original P0 carries only the student signature and the Surat Kebenaran is pending, re-opening P0 to capture this baseline is cleaner than amending a countersigned document, but it adds a dependency — the supervisor and Pengetua must countersign the new baseline before G2 can close (negative trade-off accepted).
- This reaffirms R-07 (scope-creep guard): C3/C4 are now governed line items in the "Won't (full version)" / "Could" tiers rather than ungoverned creep, and the explicit "Won't (v1)" list is the artefact R-07's mitigation calls for.
- C3 inherits an external dependency (Meta App Review) and C2 mode-3 inherits a content dependency (the manual must be authored and image storage decided) — both are reflected as gated Should/Could items so a slip in either does not threaten the Must tier.
- PDPA is recorded as a design constraint on the Student-AI-on-public-articles "Won't" item, not as a blocker this pass: the FYP uses synthetic data only, so no PDPA rule is breached yet (ADR-008, R-12).
- Supersedes nothing; revises the implicit scope of the signed PP/PS by formal baseline. Builds on ADR-018, ADR-019 (C1), and the AI-mode decisions (C2) recorded in ADR-020..022.

**References.**
- PP.md (PSM1.PF.05, supervisor-signed 16.4.26) — Section C objectives and scope.
- PS.md Slides 14, 16, 22, 26 — objectives, project scope, NABC approach, four-module use-case diagram.
- 00-master-plan.md §2 (Definition of Done), §6 (P0 decisions, locked 2026-05-05, student-signed only), §8-9 (R-07, gates G2/G3).
- 00-meta/risk-register.md R-07 (scope creep into LMS/grading), R-12 (synthetic-data-only constraint).
- ADR-018, ADR-019 (C1 Supabase Auth); ADR-020, ADR-021, ADR-022 (C2 agentic AI modes); ADR-008 (PDPA-aligned design).
- moscow-scope.md (this ADR's product).

---

<!-- Append new ADRs below using the template in 98-templates/adr-template.md. Do not edit accepted ADRs in place; supersede them. -->
