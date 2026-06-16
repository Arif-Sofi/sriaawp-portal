import type { ReactNode } from "react";

type PortalHeaderProps = {
  brand: ReactNode;
  search?: ReactNode;
  right?: ReactNode;
};

export function PortalHeader({ brand, search, right }: PortalHeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-14 bg-primary text-primary-foreground">
      <div className="container flex h-full items-center gap-4">
        <div className="shrink-0">{brand}</div>
        {search ? (
          <div className="flex flex-1 justify-center">
            <div className="w-full max-w-md">{search}</div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {right ? <div className="flex shrink-0 items-center gap-3">{right}</div> : null}
      </div>
    </header>
  );
}
