import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DataTableShellProps = {
  title?: string;
  search?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  filters?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** When false, skip horizontal scroll wrapper (card grids). Default true. */
  scrollable?: boolean;
};

export function DataTableShell({
  title,
  search,
  searchPlaceholder = "بحث...",
  onSearchChange,
  filters,
  actions,
  children,
  className,
  scrollable = true,
}: DataTableShellProps) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-[var(--mds-radius-lg)] border border-border bg-card p-3 shadow-[var(--mds-elevation-1)] sm:p-4",
        className
      )}
    >
      {(title || typeof search === "string" || actions || filters) && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              {title ? <h3 className="text-sm font-semibold tracking-tight">{title}</h3> : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {typeof search === "string" && onSearchChange ? (
                <Input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-11 min-w-0 sm:h-9 sm:min-w-56"
                  aria-label={searchPlaceholder}
                />
              ) : null}
              {actions}
            </div>
          </div>
          {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
        </div>
      )}
      <div
        className={cn(
          scrollable && "overflow-x-auto rounded-[var(--mds-radius-md)] border border-border"
        )}
      >
        {children}
      </div>
    </section>
  );
}
