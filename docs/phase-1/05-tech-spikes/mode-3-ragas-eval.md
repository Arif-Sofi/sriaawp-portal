# Mode-3 manual-RAG evaluation — RAGAS methodology and golden set

**Status.** Methodology and golden-set scaffold complete; the live RAGAS run is
gated on a Gemini key (`GOOGLE_GENERATIVE_AI_API_KEY`) and the ingested manual.
**Author.** Muhammad Arif Hakimi.
**Scope.** AI **Mode 3 only** (ADR-020). Modes 1/2 ground on news, not on an
embedded corpus, so RAGAS retrieval metrics do not apply to them.

## Why this exists (issue #5 re-scope, ADR-020)

Master-plan 11.5 specifies a golden-100 + RAGAS gate for the original
document-RAG pipeline. ADR-020 narrows the embedded corpus to the single
"how-to-use-this-system" manual, so the eval is re-scoped: a **manual-scoped
golden set** plus the same RAGAS metrics, run over Mode 3's flat-scan retrieval +
`gemini-2.5-flash` grounded answer. This document records the harness, the
metrics, and the thresholds; the live measurement is a turn-on step.

## Golden set

- Location: `tests/ai/fixtures/manual-golden-set.json`.
- Each case carries a `question`, the `expected_section_id` it must ground on
  (a `ManualSection.sectionId` in `src/lib/ai/manual/stand-in.ts`), a
  `ground_truth` reference answer, and an `off_manual` flag.
- `off_manual: true` cases assert the `tau_refuse` refusal path: the top cosine
  score must fall below the threshold and the route must return the grounded
  refusal, not an LLM guess.
- The set is authored against the synthetic stand-in manual. When the PM's real
  manual lands (P0-Q18), the golden set is **re-authored** to the real sections
  and the corpus is **re-ingested** (`npm run db:ingest-manual`) — no code change.

## Metrics and thresholds

Run with the RAGAS framework over the grounded answers. The acceptance gate
(master-plan 11.5, re-scoped to the manual):

| Metric | Threshold | What it checks |
| --- | --- | --- |
| Faithfulness | >= 0.85 | The answer's claims are entailed by the retrieved manual sections (no hallucination). |
| Answer relevancy | >= 0.80 | The answer addresses the question asked. |
| Context precision | >= 0.70 | The retrieved sections are relevant to the question (flat-scan ranking quality). |

For `off_manual` cases the gate is binary: retrieval must refuse. These cases
also feed the `tau_refuse` tuning curve in `spike-pgvector-gemini.md` — a refusal
that should have grounded (false refuse) or a grounding that should have refused
(false ground) is a threshold-tuning signal, not a RAGAS score.

## Harness (turn-on)

1. Apply migration `0008` and ingest the manual: `npm run db:ingest-manual`
   (needs a live Gemini key; embeds the stand-in via `gemini-embedding-001`).
2. For each golden case, drive `POST /api/rag/ask` with `mode: "manual_rag"` and
   capture the streamed answer plus the `data-citations` chunk refs as the
   retrieved context.
3. Score grounded cases with RAGAS (faithfulness / answer relevancy / context
   precision) against the `ground_truth`; assert refusal on `off_manual` cases.
4. Compare against the thresholds above. Record scores in the spike write-up.

The run is **deliberately not in CI / `npm test`**: it makes live Gemini calls.
Scores are **not** fabricated here — only the methodology and the golden set are
committed. The numbers are produced once the key and the real manual are in place.
