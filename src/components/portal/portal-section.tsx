import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

type PortalSectionProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function PortalSection({ title, action, children }: PortalSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
          {action ? <div className="text-sm text-primary">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
