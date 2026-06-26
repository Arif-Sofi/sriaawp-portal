// spike: consumed by the #79 cut-over. Not yet wired into live code (Auth.js
// remains the live auth until #79). See spike-supabase-auth-ssr-app-router.md.
import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In a Server Component the cookie store is read-only; the write
          // throws and is intentionally swallowed because proxy.ts already
          // refreshed the session for this request (see updateSession).
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // no-op: read-only cookie store outside a Server Action / route handler
          }
        },
      },
    },
  );
}
