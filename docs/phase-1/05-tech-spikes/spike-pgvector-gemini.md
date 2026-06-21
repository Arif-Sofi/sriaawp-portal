# Spike — pgvector + Gemini embeddings, Mode 3 manual RAG (`vector` ext, `gemini-embedding-001` 1536-d, `ai@6.0.175`, `@ai-sdk/google@3.0.67`)

**Status.** Done (empirical recall/tau_refuse curve gated on a live Gemini key + the real manual).
**Author.** Muhammad Arif Hakimi.
**Started / Completed.** 2026-06-21 / 2026-06-21.
**Effort.** ~0.5 day.

## Goal

Prove pgvector retrieval works for AI **Mode 3 only** (ADR-020): a single
"how-to-use-this-system" manual of tens of chunks, embedded with
`gemini-embedding-001` at 1536-d, retrieved by a **flat exact cosine scan**
(no HNSW), with a `tau_refuse` gate that refuses off-manual questions.

## Re-baseline (ADR-020) this spike implements

Issue #13 was originally a pgvector spike over the projected <=100k school-document
chunks. ADR-020 narrowed it: the v1 RAG corpus is **one short manual of tens of
chunks**, not the school document set. Three rulings follow and shape this spike:

- **Flat scan, not HNSW.** At tens of chunks the HNSW index (`m=16,
  ef_construction=64`, ADR-005) is over-sized; a sequential cosine scan over the
  whole embedding table is faster (no approximate-search recall loss) and simpler
  (no index build, no `ef_search` tuning). HNSW is recorded as **deferred to the
  v2 document corpus**. No vector index is created in v1.
- **Text-only embeddings.** `gemini-embedding-001` at `outputDimensionality=1536`
  (ADR-006). Image links are section metadata, never embedded; the multimodal
  `gemini-embedding-2-preview` is not needed.
- **tau_refuse must refuse off-manual questions** and is tuned on hand-written
  manual QA pairs. Master-plan 11.5 starts at 0.30 cosine; ADR-006 warns Gemini's
  cosine distribution differs from OSS baselines.

## Versions pinned

- `ai@6.0.175` (from `package.json`; `node_modules/ai/package.json`) — `embed` / `embedMany`.
- `@ai-sdk/google@3.0.67` (`node_modules/@ai-sdk/google/package.json`) — `google.textEmbeddingModel`.
- pgvector `vector` extension (Supabase-hosted Postgres, ADR-005). `vector(1536)` column type.
- Embedding model: `gemini-embedding-001` at `outputDimensionality=1536` (ADR-006).

## Docs read

Per [`AGENTS.md`](../../../AGENTS.md), the installed type surface — not
training-data assumptions — is canonical. `ai@6` / `@ai-sdk/google@3` are newer
than the assistant's training data, so the embedding API was verified against the
shipped `.d.ts`:

- `node_modules/ai/dist/index.d.ts` — `embed({ model, value, providerOptions })`
  returns `EmbedResult` (`{ embedding, usage, ... }`); `embedMany({ model, values,
  providerOptions })` returns `EmbedManyResult` (`{ embeddings, ... }`). `ai` also
  exports a `cosineSimilarity` helper (noted below).
- `node_modules/@ai-sdk/google/dist/index.d.ts` — `google.textEmbeddingModel(id)`
  (aliases `embedding` / `textEmbedding` / `embeddingModel`) returns an
  `EmbeddingModelV3`. `GoogleEmbeddingModelOptions` is `{ outputDimensionality?,
  taskType?, content? }`, where `taskType` enumerates `RETRIEVAL_DOCUMENT` /
  `RETRIEVAL_QUERY` / ... The provider reads `GOOGLE_GENERATIVE_AI_API_KEY` from
  the environment automatically.
- `supabase/migrations/0005_documents.sql` + `src/db/schema/documents.ts` — the
  live `document` / `document_version` / `document_chunk` conventions the
  reference manual DDL mirrors so issue #26 can reconcile.

## Verified installed API surface (embedding path)

| Concern | `ai@6` / `@ai-sdk/google@3` reality (verified) | Common older-API assumption |
| --- | --- | --- |
| Embedding model | `google.textEmbeddingModel('gemini-embedding-001')` | older code used `google.embedding(...)` only |
| Single embed | `await embed({ model, value, providerOptions })` -> `{ embedding }` | `embed` shape is stable, `providerOptions` is the new lever |
| Batch embed | `await embedMany({ model, values, providerOptions })` -> `{ embeddings }` | per-call loop assumed; `embedMany` batches |
| 1536-d output | `providerOptions.google.outputDimensionality = 1536` | older code passed `dimensions:` at the top level |
| Asymmetric RAG | `providerOptions.google.taskType = 'RETRIEVAL_DOCUMENT' \| 'RETRIEVAL_QUERY'` | OSS embedders had no task-type asymmetry |
| Credentials | provider reads `GOOGLE_GENERATIVE_AI_API_KEY` from env | same |

The load-bearing finding: **`outputDimensionality=1536` is a provider option,
passed as `providerOptions: { google: { outputDimensionality: 1536 } }`** — not a
top-level `dimensions` argument. `gemini-embedding-001` is MRL-trained, so 1536 is
a truncation-safe preset (ADR-006). The helper also sets `taskType` so manual
sections (`RETRIEVAL_DOCUMENT`) and the user question (`RETRIEVAL_QUERY`) embed
into the same retrieval space.

`ai` exports its own `cosineSimilarity`, but this spike writes its own pure
`cosineSimilarity` in `src/lib/ai/retrieve.ts` so the flat-scan ranker + tau_refuse
gate are unit-tested as a self-contained unit (the math is trivial and the test
pins known-vector expectations).

## pgvector enable + the manual table shape (reference SQL)

Reference DDL: [`pgvector/manual-corpus.sql`](./pgvector/manual-corpus.sql).
**Reference-only** — kept OUT of `supabase/migrations/` and out of the drizzle-kit
journal (same approach as spikes #11/#12); issue #26 promotes it into a real
migration. It is **not run** against the live project.

- `create extension if not exists vector;` — the live `0000` migration enables
  `pgcrypto` and explicitly defers `vector` (ADR-016); issue #26 lands this line.
- `manual_chunk` — `id uuid PK`, `section_heading text`, `chunk_index int`,
  `content text`, `image_urls text[]` (section metadata), `token_count int`,
  `created_at`. One task per section -> one chunk.
- `manual_embedding` — `id uuid PK`, `chunk_id uuid FK`, `model text` pinned to
  `gemini-embedding-001`, `dim int = 1536`, `embedding vector(1536)`, `created_at`;
  `unique(chunk_id)` and a `check (dim = 1536)` guard.
- **No HNSW index.** A comment block records the deferred v2 index
  (`using hnsw (embedding vector_cosine_ops) with (m=16, ef_construction=64)`).

### How issue #26 must reconcile with the live `document_chunk` (0005_documents.sql)

The manual corpus deliberately **diverges** from the live `document_chunk`, and #26
must decide whether the manual is a sibling table (as drafted) or a special row in
the existing tables:

- **No `document_id` / `version_id` FKs.** `document_chunk` hangs off
  `document` + `document_version` (a versioned uploaded file). The manual is a
  single logical corpus with no uploaded-file parent, so `manual_chunk` uses a
  `section_heading` + `chunk_index` instead of the `page_from` / `page_to` +
  `document_id` provenance.
- **`image_urls text[]` is new.** `document_chunk` has no image metadata; Mode 3
  returns section screenshots as links (ADR-020), so `manual_chunk` adds the array.
- **No `acl_keys`.** `document_chunk.acl_keys text[] not null` drives the
  per-document RBAC pre-filter (master-plan 11.5). The manual is a single
  uniformly-visible corpus in v1, so there is no per-chunk ACL. (Per-section
  role-scoping is a v2 question, left open.)
- **Embedding lives in a separate table.** The live schema has no embedding column
  yet; `0005` predates the `vector` extension. The manual keeps the vector in
  `manual_embedding` (one row per chunk, `model` pinned per ADR-006) rather than a
  column on `manual_chunk`, so a model upgrade can run side-by-side. #26 should
  apply the same one-embedding-per-chunk, model-pinned pattern when it adds an
  `embedding` table for `document_chunk`.

Shared conventions kept identical so #26 reconciles cleanly: `uuid` PKs with
`gen_random_uuid()`, a `chunk_index` ordering column, a `text content` column, and
`created_at timestamptz default now()`.

## The 1536-d ingestion path (verified API)

Helper: [`src/lib/ai/embed.ts`](../../../src/lib/ai/embed.ts).

```ts
import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";

const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");

// corpus side — embed every manual section as RETRIEVAL_DOCUMENT
const { embeddings } = await embedMany({
  model: embeddingModel,
  values: sectionBodies,
  providerOptions: { google: { outputDimensionality: 1536, taskType: "RETRIEVAL_DOCUMENT" } },
});

// query side — embed the user question as RETRIEVAL_QUERY
const { embedding } = await embed({
  model: embeddingModel,
  value: question,
  providerOptions: { google: { outputDimensionality: 1536, taskType: "RETRIEVAL_QUERY" } },
});
```

Ingestion would: chunk the manual one-section-per-chunk (the stand-in is already
structured this way), `embedMany` the bodies as `RETRIEVAL_DOCUMENT`, and insert
each `(chunk, vector(1536))` pair. Image links ride as `manual_chunk.image_urls`
metadata and are never embedded.

## Flat exact cosine scan + why HNSW is over-sized here

Retrieval: [`src/lib/ai/retrieve.ts`](../../../src/lib/ai/retrieve.ts).

The DB path reads every `manual_embedding` row and ranks in the application; the
pure cosine math is factored into `cosineSimilarity(a, b)` so the ranker is
unit-tested with no DB and no live embedder. `rankByCosine(queryEmbedding, chunks)`
scores every chunk, sorts descending, applies the tau_refuse gate, and returns the
top-k grounded chunks.

**Why flat, not HNSW.** HNSW is an *approximate* nearest-neighbour index: it trades
a small recall loss for sub-linear search over large corpora, and it carries a
build step plus `ef_construction` / `ef_search` tuning. At tens of chunks a full
sequential scan is O(n) over a trivially small n — it is faster end-to-end than
building and probing an approximate index, returns *exact* nearest neighbours (no
recall loss), and removes the tuning surface entirely. The ADR-005 HNSW parameters
(`m=16, ef_construction=64`) were sized for <=100k document chunks and are recorded
as **deferred to the v2 document corpus**; the reference SQL keeps the exact index
DDL in a comment so v2 can adopt it without re-deriving it. The application cosine
matches `vector_cosine_ops` (the `<=>` cosine-distance operator), so ranking is
identical when the index is later introduced.

## tau_refuse tuning methodology

`tau_refuse` is the cosine floor below which Mode 3 **refuses** rather than
grounding on a weak chunk — the manual-RAG analogue of "I don't know" for
off-manual questions.

- **QA pairs.** Hand-write a small set of manual QA pairs: (a) **on-manual**
  questions whose answer a manual section covers, and (b) **off-manual** questions
  the manual does not cover (and which must be refused). For the stand-in these are
  questions like "How do I read news?" (on-manual) vs "What is the school's bank
  account number?" (off-manual).
- **Empirical-curve procedure.** Embed each question (`RETRIEVAL_QUERY`), flat-scan
  the embedded manual, and record the **top-1 cosine** per question. This yields two
  score distributions — on-manual (should be high) and off-manual (should be low).
  Sweep tau_refuse across the gap between the distributions and pick the value that
  maximises correct accept/refuse decisions (or, weighting safety, the lowest false
  refusal at zero false accept). The decision metric is per-question
  accept-vs-refuse correctness, evaluated exactly as the Mode 3 RAGAS gate
  (master-plan 11.5) frames faithfulness.
- **0.30 start point + Gemini caveat.** Master-plan 11.5 starts tau_refuse at 0.30
  cosine, sized against OSS-baseline embedders. ADR-006 warns that Gemini's cosine
  distribution differs from OSS baselines, so 0.30 is a *starting hypothesis*, not a
  measured value — the real value is whatever the swept curve picks on Gemini's
  actual distribution.

### Documented initial value (methodology-derived, NOT measured)

`DEFAULT_TAU_REFUSE = 0.30` in `src/lib/ai/retrieve.ts`.

**Exactly how it was derived:** it is the master-plan 11.5 OSS-baseline 0.30
starting point carried over verbatim as a provisional default, explicitly flagged
(in code and here) as pending live re-tuning on the Gemini cosine distribution.
**It is not a measured number** — no live embedding was possible in this
environment (the Gemini key is present-but-empty; see Pitfalls). The empirical
curve that would replace 0.30 with a tuned value is **gated on a real Gemini key
and the real manual (Q18)**. Recording a methodology-derived placeholder rather
than a fabricated measurement keeps the thesis audit trail honest.

## Retrieval result shape (issue #81 consumes this)

`rankByCosine` returns a discriminated union:

```ts
type RetrievalResult =
  | { grounded: true; chunks: RankedManualChunk[] }            // top-k, ranked
  | { grounded: false; reason: "below_tau_refuse"; topScore: number | null }; // refusal

type RankedManualChunk = {
  chunkId: string;        // -> ChunkCitation.chunkId (envelope.ts)
  sectionHeading: string; // -> ChunkCitation.manualSection
  content: string;        // grounds the model's `system` context
  imageLinks: ImageLink[];// -> data-image-links part (envelope.ts ImageLink)
  score: number;          // -> ChunkCitation.score
};
```

The shape lines up field-for-field with the streaming envelope from spike #14
([`src/lib/ai/envelope.ts`](../../../src/lib/ai/envelope.ts)): each grounded chunk
maps to a `ChunkCitation` (`chunkId` / `manualSection` / `score`) written as a
`data-citations` part, and `imageLinks` (the `ImageLink` type) maps to the
`data-image-links` part. So issue #81's `/api/rag/ask` Mode 3 path can: refuse when
`grounded === false`, else stuff `chunks[].content` into the `system` prompt and
emit the image links + citations alongside the streamed text in one SSE envelope.
This supersedes the `STUBBED_MANUAL_CHUNK` placeholder in
[`src/lib/ai/manual-stub.ts`](../../../src/lib/ai/manual-stub.ts) — the stub's
`RetrievedManualChunk` was the envelope-only proof; `RankedManualChunk` is the real
retrieval output #81 attaches.

## Synthetic stand-in manual

[`src/lib/ai/manual/stand-in.ts`](../../../src/lib/ai/manual/stand-in.ts) — five
short portal how-to sections ("How a parent reads news", "How a parent asks a
question about an announcement", "How a teacher answers a parent comment", "How an
admin links a family", "How to ask the portal assistant"), each with a heading,
one-task body, and a placeholder image link.

**This is a stand-in for the PM-owned real manual (ADR-020 / Q18), which does not
exist yet.** It exists only to retire the technical retrieval risk against a
realistic tens-of-chunks shape without blocking on the real manual. Mode 3 is
**design-complete but not implementable** until the real manual is authored and the
image-storage decision (ADR-020 open) is made.

## Pitfalls encountered

1. **`outputDimensionality` is a provider option, not a top-level arg.** It rides in
   `providerOptions.google.outputDimensionality`, verified against
   `GoogleEmbeddingModelOptions` — older-SDK memory of a top-level `dimensions:` is
   wrong for `@ai-sdk/google@3`.
2. **`gemini-embedding-001` is asymmetric.** It exposes `taskType`
   (`RETRIEVAL_DOCUMENT` vs `RETRIEVAL_QUERY`); embedding both corpus and query the
   same way leaves recall on the table. The helper sets the task type per call.
3. **`ai` already ships a `cosineSimilarity`.** This spike still writes its own pure
   function so the ranker + tau_refuse gate are a self-contained, DB-free,
   embedder-free unit-tested module — the math is trivial and the test pins
   known-vector expectations.
4. **Live embedding is credential-blocked, not code-broken.** A real `embed` call
   against `gemini-embedding-001` was dispatched and failed at the credential
   boundary: `Method doesn't allow unregistered callers (callers without
   established identity)` — because `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`
   is present-but-empty (a placeholder), identical to spike #12's outcome. So the
   ingestion code path is proven by typecheck + a real network dispatch that failed
   only at auth; **no embedding vectors and therefore no empirical recall /
   tau_refuse curve were captured live.**

## What was executed vs gated (thesis audit trail)

- **Executed:** embedding API verified against installed `.d.ts`; reference manual
  DDL authored and reconciled against `0005_documents.sql`; the flat-scan ranker +
  tau_refuse gate implemented and **unit-tested (12 tests, known-vector cosine +
  ranking + refusal)**; a real `embed` call dispatched (rejected at auth — Pitfall
  4); `typecheck` / `lint` / `npm test` (42 passed, 4 RLS skipped) / `build` green.
- **Gated:** live embedding vectors and the empirical recall / tau_refuse curve
  (need a real Gemini key); Mode 3 end-to-end ingestion + retrieval against the live
  DB (the manual table is reference-only, not migrated — issue #26); the real manual
  (Q18, PM-owned) and the image-storage decision (ADR-020 open).

## Decision

pgvector + `gemini-embedding-001` retire the Mode 3 retrieval risk for issue #13
under the ADR-020 re-baseline. The v1 design is: `gemini-embedding-001` at
`outputDimensionality=1536` (passed via `providerOptions.google`) over a
single-manual corpus of tens of chunks; a **flat exact sequential cosine scan**
(no HNSW — HNSW `m=16, ef_construction=64` deferred to the v2 document corpus);
image links carried as section metadata, never embedded; and a `tau_refuse` gate
(provisional 0.30, methodology-derived, pending live tuning) that refuses
off-manual questions. The retrieval result shape maps field-for-field to the
spike #14 streaming envelope so issue #81 can attach image links + citations. The
outstanding gates are a valid Gemini key (to measure the tau_refuse curve), the
real manual (Q18), the manual-table migration (issue #26), and the image-storage
decision — all already tracked by ADR-020.

## Open questions / follow-up

- Populate `GOOGLE_GENERATIVE_AI_API_KEY` and run the QA-pair sweep to replace the
  provisional 0.30 with a Gemini-measured tau_refuse.
- Author the real "how-to-use-this-system" manual (ADR-020 / Q18, PM-owned).
- Decide image storage for Mode 3 links (Supabase Storage public bucket candidate,
  ADR-020 open).
- Issue #26 promotes `manual-corpus.sql` into a real migration and reconciles it
  with `document_chunk` per the divergence notes above.
- Issue #81 wires `rankByCosine` into the `/api/rag/ask` Mode 3 path, replacing the
  `manual-stub.ts` envelope placeholder.

## References

- Issue #13 (this spike, re-baselined by ADR-020), issue #81 (Mode 3 retrieval
  feature), issue #26 (manual/embedding migration), issue #14 (Vercel AI SDK spike,
  the envelope this result feeds).
- ADR-020 (three grounded AI modes; Mode 3 manual RAG, HNSW over-sized for a
  tens-of-chunks corpus), ADR-005 (pgvector store; HNSW deferred to v2), ADR-006
  (`gemini-embedding-001` 1536-d; text-only, image links are metadata), ADR-007
  (Gemini key / quota), ADR-008 (synthetic-data-only during FYP).
- master-plan 11.5 (RAG pipeline; tau_refuse 0.30 start point, RAGAS gate — scoped
  to Mode 3 by ADR-020).
- [`../98-templates/spike-template.md`](../98-templates/spike-template.md),
  [`./spike-vercel-ai-sdk-gemini.md`](./spike-vercel-ai-sdk-gemini.md) (house format
  + the streaming envelope).
- [`./pgvector/manual-corpus.sql`](./pgvector/manual-corpus.sql),
  [`../../../src/lib/ai/embed.ts`](../../../src/lib/ai/embed.ts),
  [`../../../src/lib/ai/retrieve.ts`](../../../src/lib/ai/retrieve.ts),
  [`../../../src/lib/ai/manual/stand-in.ts`](../../../src/lib/ai/manual/stand-in.ts),
  [`../../../tests/ai/retrieve.test.ts`](../../../tests/ai/retrieve.test.ts),
  `supabase/migrations/0005_documents.sql` (the schema #26 reconciles with).
```
