import { jsonSchema, tool } from "ai";

import type { listVisibleNews } from "@/lib/content/queries";
import type { AuthedUser } from "@/lib/rbac";

type NewsRow = Awaited<ReturnType<typeof listVisibleNews>>[number];

export type GetNewsFilters = {
  keyword?: string;
  deptId?: string;
  sinceISO?: string;
  limit?: number;
};

export type GetNewsRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  deptId: string | null;
  publishedAt: string | null;
};

const MAX_ROWS = 20;

const filtersSchema = jsonSchema<GetNewsFilters>({
  type: "object",
  additionalProperties: false,
  properties: {
    keyword: {
      type: "string",
      description: "Case-insensitive substring matched against title, excerpt, and body.",
    },
    deptId: { type: "string", description: "Restrict to a single department id." },
    sinceISO: {
      type: "string",
      description: "ISO-8601 timestamp; only news published at or after this instant.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_ROWS,
      description: `Maximum rows to return (capped at ${MAX_ROWS}).`,
    },
  },
});

function matchesKeyword(row: NewsRow, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  const haystack = `${row.title} ${row.excerpt ?? ""} ${row.body}`.toLowerCase();
  return haystack.includes(needle);
}

function applyFilters(rows: NewsRow[], filters: GetNewsFilters): NewsRow[] {
  const sinceMs = filters.sinceISO ? Date.parse(filters.sinceISO) : null;
  return rows.filter((row) => {
    if (filters.deptId && row.deptId !== filters.deptId) return false;
    if (filters.keyword && !matchesKeyword(row, filters.keyword)) return false;
    if (sinceMs === null) return true;
    const publishedMs = row.publishedAt ? row.publishedAt.getTime() : null;
    return publishedMs !== null && publishedMs >= sinceMs;
  });
}

function toToolRow(row: NewsRow): GetNewsRow {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    deptId: row.deptId,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

/**
 * The caller-scoped grounding source for AI Mode 2 (ADR-020). The visibility
 * bound is delegated entirely to `listVisibleNews`: every row the model can
 * ground on is already permitted to the caller under ADR-010, and the structured
 * filters only narrow that bounded set further. The AI layer is therefore never
 * a privilege-escalation path around the news visibility taxonomy.
 */
export function createGetNewsTool(
  caller: Pick<AuthedUser, "roles">,
  fetchVisibleNews: typeof listVisibleNews,
) {
  return tool({
    description:
      "Fetch recent school news the current user is allowed to see, optionally narrowed by keyword, department, or recency. Returns only news visible to this user.",
    inputSchema: filtersSchema,
    execute: async (filters: GetNewsFilters): Promise<GetNewsRow[]> => {
      const visible = await fetchVisibleNews(caller);
      const limit = Math.min(filters.limit ?? MAX_ROWS, MAX_ROWS);
      return applyFilters(visible, filters).slice(0, limit).map(toToolRow);
    },
  });
}
