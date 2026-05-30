import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listAllMemos } from "@/lib/content/queries";
import { requirePermission } from "@/lib/rbac";
import { AdminMemoForm } from "./_components/admin-memo-form";

export default async function AdminMemosPage() {
  await requirePermission("memo:author");
  const items = await listAllMemos();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Memo management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and manage internal memos for staff and parents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">Create memo</h2>
        </CardHeader>
        <CardContent>
          <AdminMemoForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">All memos</h2>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No memos yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.visibility}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.pinned ? <Badge variant="info">Pinned</Badge> : null}
                    <Badge variant={item.publishedAt ? "success" : "warning"}>
                      {item.publishedAt ? "Published" : "Draft"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
