import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/rbac";
import { dashboardPathForRoles } from "@/lib/navigation";

import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

async function originFromHeaders(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const existingUser = await getCurrentUser();
  if (existingUser) redirect(dashboardPathForRoles(existingUser.roles));

  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/portal";
  const errorCode = params.error;

  async function sendMagicLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    const origin = await originFromHeaders();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
      },
    });
    if (error) redirect("/login/error");
    redirect("/login/check-email");
  }

  async function signInWithGoogle() {
    "use server";
    const origin = await originFromHeaders();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
      },
    });
    if (error || !data.url) redirect("/login/error");
    redirect(data.url);
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-teal-50 to-white px-4 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md ring-1 ring-slate-100">
        <header className="mb-6 flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-lg font-semibold text-white"
          >
            SR
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Portal SRIAAWP</h1>
          <p className="text-sm text-slate-500">Log Masuk / Sign in</p>
        </header>
        <LoginForm action={sendMagicLink} googleAction={signInWithGoogle} errorCode={errorCode} />
        <footer className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          Sekolah Rendah Islam Antarabangsa Wilayah Persekutuan
        </footer>
      </section>
    </main>
  );
}
