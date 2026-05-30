import { cn } from "@/lib/utils/cn";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-sm", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {item.href && !isLast ? (
              <a
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className={isLast ? "text-foreground font-medium" : "text-muted-foreground"}
              >
                {item.label}
              </span>
            )}
            {!isLast ? (
              <span className="text-muted-foreground" aria-hidden="true">
                /
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
