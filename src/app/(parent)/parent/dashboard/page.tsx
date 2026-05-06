import { forbidden } from "next/navigation";

import { hasPermission, requireUser } from "@/lib/rbac";

import { PendingApprovalNotice } from "./pending-approval-notice";

export default async function ParentDashboardPage() {
  const user = await requireUser();
  if (user.status === "PENDING_VERIFICATION") return <PendingApprovalNotice />;
  if (!hasPermission(user, "user:read:self")) forbidden();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">Papan Pemuka Ibu Bapa</h1>
      <p className="mt-1 text-sm text-slate-500">Parent dashboard</p>
      <p className="mt-6 text-sm text-slate-700">
        Selamat datang, {user.name ?? user.email}. Pautan kepada anak-anak anda akan muncul di
        sini selepas pendaftaran lengkap.
      </p>
    </main>
  );
}
