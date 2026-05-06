import Link from "next/link";

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-teal-50 to-white px-4 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-md ring-1 ring-slate-100">
        <h1 className="text-xl font-semibold text-slate-900">Log masuk gagal</h1>
        <p className="mt-1 text-sm text-slate-500">Sign-in failed</p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
          <p>
            Pautan log masuk tidak sah atau sudah tamat tempoh. Sila kembali ke halaman log masuk
            dan minta pautan baharu.
          </p>
          <p className="text-slate-500">
            The sign-in link is invalid or has expired. Please return to the sign-in page and
            request a new link.
          </p>
        </div>

        {error ? (
          <p className="mt-4 font-mono text-xs text-slate-400">code: {error}</p>
        ) : null}

        <Link
          href="/login"
          className="mt-8 inline-block rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700"
        >
          Kembali ke log masuk / Back to sign-in
        </Link>
      </section>
    </main>
  );
}
