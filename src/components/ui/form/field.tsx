import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type LabelProps = ComponentProps<"label">;

export function Label({ className, ...props }: LabelProps) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}

type FieldErrorProps = ComponentProps<"p">;

export function FieldError({ className, ...props }: FieldErrorProps) {
  return <p role="alert" className={cn("text-sm text-destructive", className)} {...props} />;
}

type FieldProps = {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function Field({ label, htmlFor, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
