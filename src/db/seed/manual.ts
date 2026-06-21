import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { ingestManual } from "@/lib/ai/ingest-manual";

/**
 * Runnable Mode-3 manual ingest (issue #81). Mirrors the seed-script pattern:
 * builds its own single-connection postgres client and delegates to
 * ingestManual. Turn-on step, NOT part of CI: it makes a LIVE Gemini embedding
 * call (gemini-embedding-001), so it needs GOOGLE_GENERATIVE_AI_API_KEY set and
 * migration 0008 applied.
 *
 *   npm run db:ingest-manual
 *
 * Re-runnable: ingestManual truncates and reloads manual_chunk/manual_embedding,
 * so swapping the PM's real manual in is a content edit to the source module
 * (src/lib/ai/manual/stand-in.ts today) plus a re-run -- no code change.
 */

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the manual ingest");
}

const client = postgres(databaseUrl, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

ingestManual(db)
  .then((summary) => {
    console.log(`manual ingest: ${summary.sectionCount} sections embedded with ${summary.model}`);
    return client.end();
  })
  .catch((error) => {
    console.error("manual ingest failed:", error);
    client.end().finally(() => {
      process.exit(1);
    });
  });
