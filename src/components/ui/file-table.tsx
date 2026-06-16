import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/empty-state";

type FileRow = {
  id: string;
  name: string;
  sizeLabel?: string;
  version?: string;
  updatedAtLabel?: string;
  href?: string;
};

type FileTableProps = {
  files: FileRow[];
  actions?: (file: FileRow) => ReactNode;
  emptyLabel?: string;
};

export function FileTable({ files, actions, emptyLabel = "No files found." }: FileTableProps) {
  if (files.length === 0) {
    return <EmptyState title={emptyLabel} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Size</th>
            <th className="px-4 py-3 text-left font-medium">Version</th>
            <th className="px-4 py-3 text-left font-medium">Updated</th>
            {actions ? <th className="px-4 py-3 text-left font-medium">Actions</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {files.map((file) => (
            <tr key={file.id} className="hover:bg-muted/50">
              <td className="px-4 py-3 font-medium text-foreground">
                {file.href ? (
                  <a href={file.href} className="text-primary hover:underline">
                    {file.name}
                  </a>
                ) : (
                  file.name
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{file.sizeLabel ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{file.version ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{file.updatedAtLabel ?? "—"}</td>
              {actions ? <td className="px-4 py-3">{actions(file)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
