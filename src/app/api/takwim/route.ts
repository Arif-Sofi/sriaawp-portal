import { type NextRequest } from "next/server";

import { listPublicOccurrences } from "@/lib/calendar/queries";

function currentMonthRange(): { fromISO: string; toISO: string } {
  const now = new Date();
  const fromISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const toISO = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { fromISO, toISO };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const defaultRange = currentMonthRange();
  const fromISO = searchParams.get("from") ?? defaultRange.fromISO;
  const toISO = searchParams.get("to") ?? defaultRange.toISO;

  const occurrences = await listPublicOccurrences({ fromISO, toISO });

  return Response.json(occurrences, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
