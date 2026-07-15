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
        "mb-4 flex flex-col gap-3 border-b border-border/80 pb-4 sm:mb-[var(--mds-space-8)] sm:flex-row sm:items-end sm:justify-between sm:gap-[var(--mds-space-4)] sm:pb-[var(--mds-space-5)]",
        className
      )}
    >
      <div className="min-w-0 space-y-1.5 sm:space-y-[var(--mds-space-2)]">
        {breadcrumb ? (
          <div className="text-xs font-medium tracking-wide text-[var(--mds-color-text-secondary)]">
            {breadcrumb}
          </div>
        ) : null}
        <h1
          className="text-xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]"
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
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-[var(--mds-space-2)] [&_button]:min-h-11 sm:[&_button]:min-h-9 [&_a]:min-h-11 sm:[&_a]:min-h-9">
          {action}
        </div>
      ) : null}
    </div>
  );
}
