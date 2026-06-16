import { signIn } from "@/lib/auth";

import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";
  const errorCode = params.error;

  async function sendMagicLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    await signIn("resend", { email, redirectTo: callbackUrl });
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
        <LoginForm action={sendMagicLink} errorCode={errorCode} />
        <footer className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          Sekolah Rendah Islam Antarabangsa Wilayah Persekutuan
        </footer>
      </section>
    </main>
  );
}
