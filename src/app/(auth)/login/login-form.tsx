"use client";

import { useFormStatus } from "react-dom";

interface LoginFormProps {
  action: (formData: FormData) => Promise<void>;
  errorCode?: string;
}

export function LoginForm({ action, errorCode }: LoginFormProps) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-slate-700">
          Alamat e-mel
          <span className="ml-2 font-normal text-slate-400">/ Email address</span>
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="nama@sriaawp.edu.my"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
        />
      </label>
      {errorCode ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Pautan log masuk gagal dihantar. Cuba sekali lagi. / Sign-in link could not be sent.
          Please try again. <span className="font-mono text-amber-600">({errorCode})</span>
        </p>
      ) : null}
      <SubmitButton />
      <p className="text-center text-xs leading-relaxed text-slate-500">
        Kami akan menghantar pautan log masuk ke e-mel anda.
        <br />
        We will send a sign-in link to your email.
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:cursor-not-allowed disabled:bg-teal-400"
    >
      {pending ? "Menghantar… / Sending…" : "Hantar pautan log masuk / Send sign-in link"}
    </button>
  );
}
