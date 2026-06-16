import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";

type PortalSearchProps = {
  placeholder: string;
};

export function PortalSearch({ placeholder }: PortalSearchProps) {
  return (
    <div role="search" className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 text-muted-foreground">
        <Icon name="search" className="h-4 w-4" />
      </span>
      <Input
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-primary-foreground/50"
        readOnly
      />
    </div>
  );
}
