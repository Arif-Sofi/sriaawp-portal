import { describe, expect, test } from "vitest";

import {
  assertCrossTenantBlocked,
  assertServiceRoleBypasses,
  readRlsTestEnv,
} from "./_rls-helpers";

const rlsEnv = readRlsTestEnv();
const liveDbAvailable = rlsEnv !== null;
const serviceRoleAvailable = liveDbAvailable && Boolean(rlsEnv?.serviceRoleKey);

// A foreign owner's user_id, seeded into the live test project. Supplied via env
// so no identity is hardcoded; the anon path must not see this row, the
// service-role path must. See docs/phase-1/05-tech-spikes/spike-supabase-rls.md.
const otherOwnerId = process.env.SUPABASE_TEST_OTHER_USER_ID ?? "";

describe.skipIf(!liveDbAvailable)("RLS — cross-tenant block (anon key, RLS active)", () => {
  test("anon client cannot SELECT another user's parent_profile row", async () => {
    await assertCrossTenantBlocked(rlsEnv!, {
      table: "parent_profile",
      ownerColumn: "user_id",
      otherOwnerId,
    });
  });

  test("anon client cannot SELECT another user's row from `users`", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(rlsEnv!.url, rlsEnv!.anonKey);

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
});

describe.skipIf(!serviceRoleAvailable)(
  "RLS — service-role bypass (v1 posture, RLS not enforced)",
  () => {
    test("service-role client CAN SELECT the same foreign parent_profile row", async () => {
      await assertServiceRoleBypasses(
        { ...rlsEnv!, serviceRoleKey: rlsEnv!.serviceRoleKey! },
        { table: "parent_profile", ownerColumn: "user_id", otherOwnerId },
      );
    });
  },
);

describe.skipIf(liveDbAvailable)("RLS — environment skip notice", () => {
  test("SUPABASE_TEST_URL not set — RLS integration test is skipped (CI behaviour by design)", () => {
    expect(liveDbAvailable).toBe(false);
  });
});
