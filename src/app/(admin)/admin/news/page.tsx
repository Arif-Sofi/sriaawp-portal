import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listAllNews } from "@/lib/content/queries";
import { requirePermission } from "@/lib/rbac";
import { AdminNewsForm } from "./_components/admin-news-form";

export default async function AdminNewsPage() {
  await requirePermission("news:author");
  const items = await listAllNews();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">News management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and manage news posts for the portal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">Create news post</h2>
        </CardHeader>
        <CardContent>
          <AdminNewsForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-card-foreground">All news posts</h2>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No news posts yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">/news/{item.slug}</p>
                  </div>
                  <Badge variant={item.publishedAt ? "success" : "warning"}>
                    {item.publishedAt ? "Published" : "Draft"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
