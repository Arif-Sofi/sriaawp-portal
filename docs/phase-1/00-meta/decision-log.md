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

<!-- Append new ADRs below using the template in 98-templates/adr-template.md. Do not edit accepted ADRs in place; supersede them. -->
