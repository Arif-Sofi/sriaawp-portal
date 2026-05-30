import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

type SpinnerSize = "sm" | "md" | "lg";

const SPINNER_SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-4",
};

type SpinnerProps = {
  size?: SpinnerSize;
  className?: string;
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full border-border border-t-primary",
        SPINNER_SIZE_CLASSES[size],
        className,
      )}
    />
  );
}

type SkeletonProps = ComponentProps<"span">;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <span
      className={cn("block animate-pulse rounded bg-muted", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
