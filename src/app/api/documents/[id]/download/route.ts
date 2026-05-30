import type { NextRequest } from "next/server";

import { getDocumentForDownload } from "@/lib/documents/queries";
import { requireUser } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await requireUser();
  const { id } = await params;

  const doc = await getDocumentForDownload({ id, user });
  if (!doc) return new Response(null, { status: 404 });

  const asciiSafe = doc.filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(doc.filename);

  return new Response(new Uint8Array(doc.content), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encoded}`,
    },
  });
}
