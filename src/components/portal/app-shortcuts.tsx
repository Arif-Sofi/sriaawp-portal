import type { ReactNode } from "react";

import { AppTile } from "./app-tile";

type ShortcutItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

type AppShortcutsProps = {
  items: ShortcutItem[];
};

export function AppShortcuts({ items }: AppShortcutsProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="flex flex-wrap gap-1 py-2">
        {items.map((item) => (
          <AppTile key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}
      </div>
    </div>
  );
}
