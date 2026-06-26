// spike: consumed by the #79 cut-over. Not yet wired into live code (Auth.js
// remains the live auth until #79). See spike-supabase-auth-ssr-app-router.md.
import { createBrowserClient } from "@supabase/ssr";

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
