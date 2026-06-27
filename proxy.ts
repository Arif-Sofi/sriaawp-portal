import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/parent", "/staff", "/admin", "/assistant", "/notifications"];

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export async function proxy(request: NextRequest) {
  // The response Supabase writes rotated cookies onto; it must be the one
  // returned so the refreshed Set-Cookie survives to the browser. Returning a
  // different NextResponse silently logs the user out at the next hop.
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser revalidates the JWT against the Auth server and triggers the
  // refresh-and-set; getSession only reads cookies and is unsafe for the gate.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!needsAuth) return response;
  if (user) return response;

  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
