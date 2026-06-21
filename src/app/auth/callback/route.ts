import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/rbac";
import { dashboardPathForRoles } from "@/lib/navigation";

// Supabase code-exchange callback for OTP magic-link and Google OAuth (PKCE).
// Supabase redirects here with ?code=...; exchangeCodeForSession sets the
// session cookies, after which the caller lands on their role dashboard.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) return NextResponse.redirect(new URL("/login/error", origin));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login/error", origin));

  if (next) return NextResponse.redirect(new URL(next, origin));

  const user = await getCurrentUser();
  const landing = user ? dashboardPathForRoles(user.roles) : "/";
  return NextResponse.redirect(new URL(landing, origin));
}
