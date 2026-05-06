import { requirePermission } from "@/lib/rbac";

export default async function AdminDashboardPage() {
  const user = await requirePermission("admin:dashboard:read");

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">Papan Pemuka Pentadbir</h1>
      <p className="mt-1 text-sm text-slate-500">Admin dashboard</p>
      <p className="mt-6 text-sm text-slate-700">
        Selamat datang, {user.name ?? user.email}. Pengurusan pengguna, peranan, dan tetapan akan
        muncul di sini.
      </p>
    </main>
  );
}
