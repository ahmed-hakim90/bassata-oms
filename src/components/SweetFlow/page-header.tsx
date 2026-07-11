import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumb?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-[var(--mds-space-6)] flex flex-col gap-[var(--mds-space-4)] border-b border-border/80 pb-[var(--mds-space-5)] sm:mb-[var(--mds-space-8)] sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-[var(--mds-space-2)]">
        {breadcrumb ? (
          <div className="text-xs font-medium tracking-wide text-[var(--mds-color-text-secondary)]">
            {breadcrumb}
          </div>
        ) : null}
        <h1
          className="text-[1.625rem] font-semibold tracking-tight text-foreground sm:text-[1.75rem]"
          suppressHydrationWarning
        >
          {title}
        </h1>
        {description ? (
          <p
            className="max-w-2xl text-sm leading-relaxed text-muted-foreground"
            suppressHydrationWarning
          >
            {description}
          </p>
        ) : null}
        {meta}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-[var(--mds-space-2)]">
          {action}
        </div>
      ) : null}
    </div>
  );
}
