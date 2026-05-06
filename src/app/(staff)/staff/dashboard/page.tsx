import { requirePermission } from "@/lib/rbac";

export default async function StaffDashboardPage() {
  const user = await requirePermission("staff:dashboard:read");

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">Papan Pemuka Kakitangan</h1>
      <p className="mt-1 text-sm text-slate-500">Staff dashboard</p>
      <p className="mt-6 text-sm text-slate-700">
        Selamat datang, {user.name ?? user.email}. Modul jabatan akan dipaparkan di sini.
      </p>
      {user.deptIds.length > 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          Department scope: {user.deptIds.length}{" "}
          {user.deptIds.length === 1 ? "department" : "departments"}
        </p>
      ) : null}
    </main>
  );
}
