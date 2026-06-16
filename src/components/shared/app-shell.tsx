import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  nav?: ReactNode;
  footer?: ReactNode;
};

export function AppShell({ children, nav, footer }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {nav}
      <main className="container flex-1 py-6">{children}</main>
      {footer}
    </div>
  );
}
