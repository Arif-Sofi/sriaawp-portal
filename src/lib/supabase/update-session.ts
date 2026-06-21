// spike: consumed by the #79 cut-over. This is the documented @supabase/ssr
// cookie-refresh pattern for proxy.ts on the Node runtime. It is NOT wired into
// the live proxy.ts yet (Auth.js gating stays live until #79). The cut-over
// drops this in as the proxy body. See spike-supabase-auth-ssr-app-router.md.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

// Refreshes the Supabase session cookies on every request and returns the
// response carrying any rotated tokens. The single supabaseResponse instance is
// mutated in setAll and returned so the rotated Set-Cookie headers survive to
// the browser, avoiding the proxy-vs-RSC cookie-write race.
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            supabaseResponse.headers.set(key, value);
          }
        },
      },
    },
  );

  // Must run before any response is generated so a token refresh is written
  // back. getUser contacts the Auth server and verifies the token (getSession
  // only reads cookies and is not safe for authorization decisions).
  await supabase.auth.getUser();

  return supabaseResponse;
}
