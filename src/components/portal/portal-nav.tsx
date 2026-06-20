import type { ReactNode } from "react";

import { AppTile } from "./app-tile";

type PortalNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

type PortalNavProps = {
  items: PortalNavItem[];
};

export function PortalNav({ items }: PortalNavProps) {
  if (items.length === 0) return null;

  return (
    <nav className="border-b border-border bg-card">
      <div className="container flex flex-wrap gap-1 py-2">
        {items.map((item) => (
          <AppTile key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}
      </div>
    </nav>
  );
}
