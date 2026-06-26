# Spike — Vercel AI SDK 6 + Gemini provider (`ai@6.0.175`, `@ai-sdk/google@3.0.67`)

**Status.** Done.
**Author.** Muhammad Arif Hakimi.
**Started / Completed.** 2026-06-21 / 2026-06-21.
**Effort.** ~0.5 day.

## Goal

Prove the Vercel AI SDK + Gemini provider primitives the three AI modes need (ADR-020), and leave a working `/api/rag/ask` Route Handler skeleton: streaming generation on `gemini-2.5-flash`, caller-scoped `get_news` tool-calling, and a streaming envelope that can carry image links + chunk citations alongside text tokens.

## Versions pinned

- `ai@6.0.175` (from `package.json`; `node_modules/ai/package.json`).
- `@ai-sdk/google@3.0.67` (`node_modules/@ai-sdk/google/package.json`).
- Re-exported provider plumbing: `@ai-sdk/provider-utils` (tool/schema helpers), `@ai-sdk/provider` (model interfaces), `zod/v4` (the SDK's internal schema lib).
- Generation model: `gemini-2.5-flash` (ADR-007), reused by all three modes.

## Docs read

Per [`AGENTS.md`](../../../AGENTS.md), the installed type surface — not training-data assumptions — is canonical. `ai@6`/`@ai-sdk/google@3` are newer than the assistant's training data, so the API was verified against the shipped `.d.ts`:

- `node_modules/ai/dist/index.d.ts` — main barrel. Confirms `streamText`, `generateText`, `tool`, `jsonSchema`, `stepCountIs`, `convertToModelMessages`, `createUIMessageStream`, `createUIMessageStreamResponse`, `UIMessageStreamWriter`, `DataUIPart`, and the `StreamTextResult.toUIMessageStream` / `.toUIMessageStreamResponse` helpers.
- `node_modules/@ai-sdk/provider-utils/dist/index.d.ts` — the real `tool()` signature (`inputSchema` + `execute`, not the older `parameters`).
- `node_modules/@ai-sdk/google/dist/index.d.ts` — the `google` default provider and `createGoogleGenerativeAI`; the provider reads `GOOGLE_GENERATIVE_AI_API_KEY` from the environment automatically.

## Verified installed API surface (what differs from older AI SDK memory)

| Concern | `ai@6` reality (verified) | Common older-API assumption |
| --- | --- | --- |
| Streaming generation | `streamText({ model, system, messages, tools, stopWhen })` | same name; `stopWhen`/`stepCountIs` replace `maxSteps` |
| Tool declaration | `tool({ description, inputSchema, execute })` | older SDKs used `parameters:` not `inputSchema:` |
| Schema without zod | `jsonSchema<T>({ ... })` from `ai` | older code reached for `zod` directly |
| Message conversion | `await convertToModelMessages(uiMessages)` is **async** | older `convertToCoreMessages` was sync |
| Streaming HTTP response | `result.toUIMessageStreamResponse()` | replaces `toDataStreamResponse()` |
| Manual stream assembly | `createUIMessageStream({ execute })` + `createUIMessageStreamResponse({ stream })`; writer is `UIMessageStreamWriter` | replaces `createDataStreamResponse` / `StreamData` |
| Side-data parts | `writer.write({ type: "data-<name>", data })` typed via `UIMessage<METADATA, DATA>` | replaces `data.append()` on `StreamData` |
| Multi-step stop | `stopWhen: stepCountIs(n)` | replaces `maxSteps: n` |

The two breaking surprises versus older-SDK memory: **`convertToModelMessages` is async** (it returned a `Promise<ModelMessage[]>`, caught by `tsc` as a non-iterable — both call sites had to `await`), and the data-stream API is gone in favour of the **UI message stream** (`data-*` typed parts).

## Hello-world reproduced

A headless `streamText` call against the real `gemini-2.5-flash` endpoint was dispatched (see Pitfalls for the credential outcome). The production skeleton is `src/app/api/rag/ask/route.ts`; it `npm run build`s into the route table as a dynamic route:

```
├ ƒ /api/rag/ask
```

`npm run typecheck`, `npm run lint` (new files), `npm test` (incl. the tool unit test), and `npm run build` are all green.

## Streaming pattern (Modes 1 and 2)

```ts
// src/lib/ai/model.ts
import { google } from "@ai-sdk/google";
export const generationModel = google("gemini-2.5-flash"); // reads GOOGLE_GENERATIVE_AI_API_KEY

// route — text-only modes return the SDK streaming Response directly
const result = streamText({
  model: generationModel,
  system,
  messages: await convertToModelMessages(body.messages),
  tools, // get_news for Mode 2, undefined for Mode 1
  stopWhen: stepCountIs(5),
});
return result.toUIMessageStreamResponse<AiUiMessage>();
```

Mode 1 (in-article) stuffs the open article into the `system` prompt — no tools, no retrieval. Mode 2 (get_news) attaches the tool and lets `stopWhen: stepCountIs(5)` run the tool loop.

## Tool-calling pattern + caller-scope security note (Mode 2)

`tool()` takes `inputSchema` (a `jsonSchema<T>(...)` so no zod dependency is added) and an `execute`. The Mode-2 grounding source is **caller-scoped by construction**: the tool never queries `news` directly; it calls the shipped `listVisibleNews(user)` predicate (ADR-010) and applies the structured filters (keyword / department / recency) over that already-bounded set.

```ts
// src/lib/ai/tools/get-news.ts (shape)
export function createGetNewsTool(caller, fetchVisibleNews) {
  return tool({
    description: "Fetch recent school news the current user is allowed to see ...",
    inputSchema: filtersSchema,
    execute: async (filters) => {
      const visible = await fetchVisibleNews(caller); // ADR-010 bound lives here
      return applyFilters(visible, filters).slice(0, limit).map(toToolRow);
    },
  });
}
```

This is the AI analogue of the master-plan 11.5 RAG RBAC pre-filter (R-04). A naive "fetch all news" tool would leak `internal`/`role_list` rows to a caller who may not see them, surfacing them through the assistant. Because the tool's input set is exactly `listVisibleNews(caller)`, the model can ground only on rows the caller already may read; the AI layer is not a privilege-escalation bypass around ADR-010.

The unit test (`tests/ai/get-news-tool.test.ts`) mocks `listVisibleNews` to return a parent-visible set (a `public` + an `internal` row) and a separate `role_list` row that is *not* in that set, then asserts: (a) the tool calls `fetchVisibleNews` with the caller, (b) every returned id is inside the mocked visible set and the `role_list` id never appears, and (c) keyword/recency filters only narrow — never widen — the bound. The bound is therefore proven structurally (the tool cannot return a row the predicate did not), not by re-checking visibility logic.

### Mode 2 round-trip cost (re-rates ADR-007 / R-11)

A Mode-2 turn is **2+ LLM round-trips**: round 1 = the model decides to call `get_news` (emits a tool call, no answer text); the SDK runs `execute` locally; round 2 = the model answers grounded on the returned rows. If the model chains fetches (e.g. recency then keyword), each extra fetch adds another round-trip, bounded here by `stopWhen: stepCountIs(5)`. So one user turn consumes **2 to 5 request units** against the ADR-007 free-tier budget (1,500 req/day, 20 req/min). The 20-req/min limit is now effectively per-user-*turn*-fan-out, not per-user-message. This confirms the ADR-020 re-derivation: R-11 (free-tier 1,500 req/day cap during UAT) must be re-rated upward before UAT, and Mode 1's full-article context-stuffing additionally inflates input tokens against the 1M TPM ceiling. No vendor change — `gemini-2.5-flash` supports tool-calling and stands.

## Image-link / citation envelope (Mode 3)

The envelope carries structured side-data **as typed UI-message data parts** on the same SSE response that streams the text. `AiUiMessage = UIMessage<never, AiSideData>` declares two data channels (`image-links`, `citations`); the route writes them through the stream writer before merging the model's text stream:

```ts
const stream = createUIMessageStream<AiUiMessage>({
  execute: async ({ writer }) => {
    writer.write({ type: "data-image-links", data: chunk.imageLinks }); // section metadata
    writer.write({ type: "data-citations", data: [citationFor(chunk)] }); // chunk refs
    const result = streamText({ model: generationModel, system, messages: [...] });
    writer.merge(result.toUIMessageStream<AiUiMessage>()); // text-delta chunks interleave
  },
});
return createUIMessageStreamResponse({ stream });
```

Mechanism: `writer.write({ type: "data-<name>", data })` emits a `DataUIPart`; `writer.merge(result.toUIMessageStream())` folds the model's `text-delta` chunks into the same stream. The client receives one ordered SSE stream where `data-image-links` / `data-citations` parts sit alongside the text deltas, so a grounded Mode-3 answer returns **text PLUS image links (section metadata) PLUS chunk citations** in a single round-trip envelope. Modes 1/2 simply never write those parts, so the channels stay empty. The retrieval that would populate them is stubbed (`src/lib/ai/manual-stub.ts`) — no embedding here (spike #13 / issue #81), only the envelope round-trip is proven.

## Citation post-processing (Mode 3 only)

Citations map streamed tokens back to retrieved manual chunk ids. Prototyped as `citationFor(chunk)` → `{ chunkId, manualSection, score }`, written as a `data-citations` part keyed to the same `chunk.chunkId` whose text was injected into the model's `system` context. In the real Mode 3 (issue #81) the retrieved chunks each carry their `chunkId`; after generation, answer spans are attributed to the chunk(s) whose text grounded them and surfaced as `data-citations`. Modes 1 and 2 have no chunk corpus and therefore no chunk citations (Mode 2's provenance is the `get_news` tool-result rows, not manual chunks).

## Audience guard (revises ADR-009 per ADR-020)

Initiating a turn in any mode requires an authenticated, non-Student account. The guard runs at the top of `POST`, before any LLM call, reusing the preserved RBAC helpers:

```ts
const user = await getCurrentUser(); // @/lib/rbac (Auth.js v5, stable across the #79 cut-over)
if (!user) return Response.json({ error: "authentication required" }, { status: 401 });
if (isStudentOnly(user)) return Response.json({ error: "... not available to students in v1" }, { status: 403 });
```

This keeps the ADR-008 minor-LLM guard intact even though Modes 1/2 ground on news (which can be `public`), because the gate is on *initiating* a turn, not on the grounding source's visibility. **Prototype caveat (honest audit trail):** the guard *code path* is written and typechecks, but it was not exercised against a live authenticated session in this headless spike — its runtime behaviour with a real `next-auth` session is validated by the auth spikes, not re-run here. `getCurrentUser` / `requireUser` signatures are stable across the #79 Supabase-Auth cut-over, so coding against them is forward-compatible.

## Pitfalls encountered

1. **`convertToModelMessages` is async in `ai@6`.** `tsc` flagged `Promise<ModelMessage[]>` as non-iterable / non-array at both the `messages:` and spread sites. Fix: `await` it. Older-SDK memory (`convertToCoreMessages`, sync) is wrong for this version.
2. **The data-stream API is gone.** No `StreamData` / `toDataStreamResponse`. Side-data now rides as typed `data-*` UI-message parts through `createUIMessageStream` + `UIMessageStreamWriter.write`, surfaced on the response by `createUIMessageStreamResponse` (or `result.toUIMessageStreamResponse()` for the text-only modes).
3. **`tool()` uses `inputSchema`, not `parameters`.** Verified against `@ai-sdk/provider-utils`. `jsonSchema<T>()` lets the tool declare its filter schema without adding `zod` as a direct dependency.
4. **Real Gemini call is headless-blocked by an empty key, not a code defect.** A headless `streamText` against `gemini-2.5-flash` built and dispatched a valid SSE streaming request to `generativelanguage.googleapis.com/.../streamGenerateContent?alt=sse`, then was rejected with `Method doesn't allow unregistered callers` — because `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local` is present-but-empty (a placeholder). So: the **streaming code path is proven by typecheck plus a real network dispatch that failed only at the credential boundary**; observed token output is *not* captured because no valid key was available in this environment. Populate the key to capture live token/usage behaviour.

## What was executed vs prototype-only (thesis audit trail)

- **Executed:** SDK API surface verified against installed `.d.ts`; `typecheck` / `lint` / unit test / `build` green; `/api/rag/ask` in the route table; a real Gemini streaming request dispatched to the live endpoint (rejected at auth — see Pitfall 4); the `get_news` caller-scope bound proven by unit test.
- **Prototype-only:** live token output (no valid API key headlessly); the authenticated audience guard at runtime (code-proven, not session-exercised); Mode 3 retrieval and image storage (stubbed — embedding is spike #13 / issue #81, the manual does not exist yet per ADR-020, image bucket undecided).

## Decision

The Vercel AI SDK 6 + `@ai-sdk/google` 3 primitives are sufficient for all three ADR-020 modes with no new dependency: `streamText` for generation on `gemini-2.5-flash`; `tool({ inputSchema, execute })` for Mode 2's caller-scoped `get_news` (scope delegated to `listVisibleNews`, never re-implemented); and the UI message stream (`createUIMessageStream` + typed `data-*` parts) as the envelope that carries Mode 3 image links and citations alongside streamed text in one SSE response. The spike retires the SDK risk for issue #80. Outstanding gating items are a valid Gemini key (to capture live behaviour), the Mode 3 retrieval/embedding (spike #13 / issue #81), the manual authoring, and the image-storage decision — all already tracked by ADR-020.

## Open questions / follow-up

- Populate `GOOGLE_GENERATIVE_AI_API_KEY` and capture live token/usage to finalise the ADR-007/R-11 quota re-rate with measured per-turn request counts.
- Mode 3 retrieval (flat cosine scan over the tiny manual corpus) — spike #13 / issue #81.
- Image storage for Mode 3 links (Supabase Storage public bucket candidate) — undecided per ADR-020.
- Author the "how-to-use-this-system" manual before Mode 3 is implementable.

## References

- Issue #14 (this spike), issue #80 (Modes 1+2 feature), issue #81 (Mode 3 retrieval), issue #13 (pgvector spike).
- ADR-020 (three grounded AI modes), ADR-007 (`gemini-2.5-flash`, quota), ADR-009 (RAG audience, revised), ADR-010 (visibility taxonomy enforced by `get_news`), ADR-008 (minor-LLM guard).
- master-plan §8 R-04 (RBAC pre-filter attack tests), R-11 (free-tier quota cap).
- `../98-templates/spike-template.md`, `./spike-nextjs-16.md` (house format).
- `src/app/api/rag/ask/route.ts`, `src/lib/ai/tools/get-news.ts`, `src/lib/ai/envelope.ts`, `src/lib/ai/manual-stub.ts`, `tests/ai/get-news-tool.test.ts`.
