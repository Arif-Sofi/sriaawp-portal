import type { ReactNode } from "react";
import Link from "next/link";

type AppTileProps = {
  href: string;
  label: string;
  icon: ReactNode;
};

export function AppTile({ href, label, icon }: AppTileProps) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-lg p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        {icon}
      </span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </Link>
  );
}
