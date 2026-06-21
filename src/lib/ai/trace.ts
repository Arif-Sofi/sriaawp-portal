import type { GetNewsFilters, GetNewsRow } from "@/lib/ai/tools/get-news";
import type { GetNewsTrace } from "@/lib/ai/persist";

type StepLike = {
  toolCalls: Array<{ toolName: string; input: unknown }>;
  toolResults: Array<{ toolName: string; output: unknown }>;
};

const GET_NEWS = "get_news" as const;

/**
 * Reconstructs the get_news tool-call trace from a finished multi-step run so the
 * retrieval_log captures the exact filters the model passed and the news ids the
 * caller-scoped tool returned. When the model called get_news more than once, the
 * last call wins (its result is what the answer is grounded on).
 */
export function extractGetNewsTrace(steps: readonly StepLike[]): GetNewsTrace | null {
  const filters = lastGetNewsInput(steps);
  if (filters === null) return null;
  return { filters, results: lastGetNewsOutput(steps) };
}

function lastGetNewsInput(steps: readonly StepLike[]): GetNewsFilters | null {
  const calls = steps
    .flatMap((step) => step.toolCalls)
    .filter((call) => call.toolName === GET_NEWS);
  const last = calls.at(-1);
  return last ? (last.input as GetNewsFilters) : null;
}

function lastGetNewsOutput(steps: readonly StepLike[]): GetNewsRow[] {
  const results = steps
    .flatMap((step) => step.toolResults)
    .filter((result) => result.toolName === GET_NEWS);
  const last = results.at(-1);
  return last ? (last.output as GetNewsRow[]) : [];
}

/**
 * Mode 2 grounds on a single news row only when the model fetched exactly one
 * candidate; with several rows in scope the answer is not attributable to one
 * item, so news_id stays NULL (issue #80).
 */
export function groundedNewsId(trace: GetNewsTrace | null): string | null {
  if (!trace) return null;
  if (trace.results.length !== 1) return null;
  return trace.results[0].id;
}
