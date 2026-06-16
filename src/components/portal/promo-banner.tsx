import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type PromoBannerTone = "primary" | "warning" | "info";

type PromoBannerProps = {
  title: string;
  body?: string;
  tone?: PromoBannerTone;
  action?: ReactNode;
};

const TONE_CLASSES: Record<PromoBannerTone, string> = {
  primary: "bg-primary text-primary-foreground",
  warning: "bg-warning text-warning-foreground",
  info: "bg-info text-info-foreground",
};

export function PromoBanner({ title, body, tone = "primary", action }: PromoBannerProps) {
  return (
    <div className={cn("rounded-lg p-6", TONE_CLASSES[tone])}>
      <p className="text-base font-semibold">{title}</p>
      {body ? <p className="mt-1 text-sm opacity-90">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
