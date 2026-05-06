interface CheckEmailPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const { email } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-teal-50 to-white px-4 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-md ring-1 ring-slate-100">
        <h1 className="text-xl font-semibold text-slate-900">Semak peti masuk anda</h1>
        <p className="mt-1 text-sm text-slate-500">Check your inbox</p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
          <p>
            Pautan log masuk telah dihantar
            {email ? (
              <>
                {" "}
                ke <span className="font-medium text-slate-900">{email}</span>
              </>
            ) : null}
            . Sila semak peti masuk anda dan klik pautan untuk teruskan. Pautan ini akan tamat dalam
            masa 24 jam.
          </p>
          <p className="text-slate-500">
            A sign-in link has been sent
            {email ? (
              <>
                {" "}
                to <span className="font-medium text-slate-700">{email}</span>
              </>
            ) : null}
            . Please check your inbox and click the link to continue. This link will expire in 24
            hours.
          </p>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          Tidak menerima e-mel? Semak folder Spam atau cuba lagi dari halaman log masuk.
          <br />
          Did not receive the email? Check your Spam folder or try again from the sign-in page.
        </p>
      </section>
    </main>
  );
}
