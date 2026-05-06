import { describe, expect, test } from "vitest";

const supabaseUrl = process.env.SUPABASE_TEST_URL;
const supabaseAnonKey = process.env.SUPABASE_TEST_ANON_KEY;

const liveDbAvailable = Boolean(supabaseUrl && supabaseAnonKey);

describe.skipIf(!liveDbAvailable)("RLS — cross-tenant block", () => {
  test("anon client cannot SELECT another user's row from `users`", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(supabaseUrl!, supabaseAnonKey!);

    const { data, error } = await anon
      .from("users")
      .select("id,email")
      .neq("email", "test-admin@sriaawp.test");

    if (error) {
      const expectedRlsErrors = ["row-level security", "permission denied", "not authorized"];
      const matched = expectedRlsErrors.some((needle) =>
        error.message.toLowerCase().includes(needle),
      );
      expect(matched).toBe(true);
      return;
    }

    expect(data ?? []).toEqual([]);
  });

  test("anon client cannot SELECT any row from `sessions`", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(supabaseUrl!, supabaseAnonKey!);

    const { data } = await anon.from("sessions").select("sessionToken").limit(1);

    expect(data ?? []).toEqual([]);
  });
});

describe.skipIf(liveDbAvailable)("RLS — environment skip notice", () => {
  test("SUPABASE_TEST_URL not set — RLS integration test is skipped (CI behaviour by design)", () => {
    expect(liveDbAvailable).toBe(false);
  });
});
