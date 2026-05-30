"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type NavLink = {
  label: string;
  href: string;
};

type NavProps = {
  brand?: ReactNode;
  links?: NavLink[];
  right?: ReactNode;
};

export function Nav({ brand, links = [], right }: NavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="border-b border-border bg-card">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          {brand ? <div className="shrink-0">{brand}</div> : null}
          <nav className="hidden items-center gap-4 md:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-3 md:flex">{right}</div>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label="Toggle navigation"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
        >
          <span className="block h-0.5 w-5 bg-current before:block before:h-0.5 before:w-5 before:bg-current before:-translate-y-1.5 after:block after:h-0.5 after:w-5 after:bg-current after:translate-y-1" />
        </button>
      </div>
      {isOpen ? (
        <div className={cn("border-t border-border bg-card px-4 pb-4 md:hidden")}>
          <nav className="flex flex-col gap-2 pt-3">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          {right ? <div className="mt-3 flex items-center gap-3">{right}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
