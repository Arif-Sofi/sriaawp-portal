export function PendingApprovalNotice() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-2xl bg-amber-50 p-8 ring-1 ring-amber-200">
        <h1 className="text-xl font-semibold text-amber-900">Akaun menunggu pengesahan</h1>
        <p className="mt-1 text-sm text-amber-700">Account pending verification</p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-amber-900">
          <p>
            Permohonan anda sedang disemak oleh pentadbir sekolah. Anda akan dimaklumkan melalui
            e-mel sebaik sahaja akaun diluluskan.
          </p>
          <p className="text-amber-800/80">
            Your registration is being reviewed by the school administrator. You will be notified by
            email once your account is approved.
          </p>
        </div>
      </div>
    </main>
  );
}
