import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type ChatRole = "user" | "assistant";

const ROLE_CLASSES: Record<ChatRole, string> = {
  user: "bg-primary text-primary-foreground self-end",
  assistant: "bg-muted text-foreground self-start",
};

type ChatBubbleProps = {
  role: ChatRole;
  children: ReactNode;
  footer?: ReactNode;
};

export function ChatBubble({ role, children, footer }: ChatBubbleProps) {
  return (
    <div
      className={cn("flex max-w-[80%] flex-col gap-1 rounded-lg px-4 py-2.5", ROLE_CLASSES[role])}
    >
      <div className="text-sm">{children}</div>
      {footer ? <div className="mt-1 flex flex-wrap gap-1">{footer}</div> : null}
    </div>
  );
}
