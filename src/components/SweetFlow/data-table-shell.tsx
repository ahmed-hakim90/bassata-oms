import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DataTableShellProps = {
  title?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DataTableShell({
  title,
  search,
  onSearchChange,
  actions,
  children,
  className,
}: DataTableShellProps) {
  return (
    <section className={cn("space-y-3 rounded-2xl border border-border/60 bg-card p-4", className)}>
      {(title || typeof search === "string" || actions) && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {typeof search === "string" && onSearchChange ? (
              <Input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="بحث..."
                className="h-9 min-w-56"
              />
            ) : null}
            {actions}
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border/60">{children}</div>
    </section>
  );
}
