import { expect } from "vitest";

// Reusable cross-tenant RLS assertions for the env-gated DB integration suite.
//
// These helpers encode the ADR-019 v1/v2 posture as two complementary checks:
//   - the authenticated/anon key path (RLS active) must NOT return another
//     tenant's rows;
//   - the service-role key path (RLS bypassed by Supabase default) MUST still
//     return them, proving the v1 connection strategy is correct-but-bypassed
//     and the live gate is the application layer (hasPermission, ADR-002).
//
// Both read connection material from env only (no hardcoded secrets) and are
// designed to be called by later RLS work (engagement, fb_sync_link) by passing
// a different table + owner column + owner identity.

export type RlsTestEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
};

export type CrossTenantCase = {
  // Table to probe, e.g. "parent_profile".
  table: string;
  // The ownership column the RLS policy keys on, e.g. "user_id".
  ownerColumn: string;
  // A foreign owner's identity. The anon path must not see rows where
  // ownerColumn = otherOwnerId; the service-role path must.
  otherOwnerId: string;
};

export const readRlsTestEnv = (): RlsTestEnv | null => {
  const url = process.env.SUPABASE_TEST_URL;
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
  if (!url) return null;
  if (!anonKey) return null;
  return { url, anonKey, serviceRoleKey: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY };
};

const RLS_ERROR_NEEDLES = ["row-level security", "permission denied", "not authorized"];

const isRlsDenial = (message: string): boolean => {
  const lowered = message.toLowerCase();
  return RLS_ERROR_NEEDLES.some((needle) => lowered.includes(needle));
};

// Under the anon/authenticated key (RLS active), selecting another tenant's
// rows must yield either an explicit RLS denial or an empty result set.
export const assertCrossTenantBlocked = async (
  env: RlsTestEnv,
  testCase: CrossTenantCase,
): Promise<void> => {
  const { createClient } = await import("@supabase/supabase-js");
  const anon = createClient(env.url, env.anonKey);

  const { data, error } = await anon
    .from(testCase.table)
    .select(testCase.ownerColumn)
    .eq(testCase.ownerColumn, testCase.otherOwnerId);

  if (error) {
    expect(isRlsDenial(error.message)).toBe(true);
    return;
  }

  expect(data ?? []).toEqual([]);
};

// Under the service-role key (RLS bypassed), the same foreign rows must be
// visible. This proves the v1 posture: the policy is correct but the service
// role sidesteps it, so the application layer remains the enforcement point.
export const assertServiceRoleBypasses = async (
  env: Required<Pick<RlsTestEnv, "serviceRoleKey">> & RlsTestEnv,
  testCase: CrossTenantCase,
): Promise<void> => {
  const { createClient } = await import("@supabase/supabase-js");
  const service = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await service
    .from(testCase.table)
    .select(testCase.ownerColumn)
    .eq(testCase.ownerColumn, testCase.otherOwnerId);

  expect(error).toBeNull();
  expect((data ?? []).length).toBeGreaterThan(0);
};
