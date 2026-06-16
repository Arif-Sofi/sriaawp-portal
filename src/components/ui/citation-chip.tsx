import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

type CitationChipProps = ComponentProps<"button"> & {
  label: string;
};

export function CitationChip({ label, className, ...props }: CitationChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      {label}
    </button>
  );
}
