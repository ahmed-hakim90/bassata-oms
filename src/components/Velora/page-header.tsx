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
  const hasSubtitle = Boolean(breadcrumb || description);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-b border-border/70 pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pb-2.5",
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <h1
          className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg"
          suppressHydrationWarning
        >
          {title}
        </h1>
        {hasSubtitle ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs leading-snug text-muted-foreground">
            {breadcrumb ? (
              <span className="font-medium text-[var(--mds-color-text-secondary)]">
                {breadcrumb}
              </span>
            ) : null}
            {breadcrumb && description ? (
              <span aria-hidden className="text-border">
                ·
              </span>
            ) : null}
            {description ? <span suppressHydrationWarning>{description}</span> : null}
          </div>
        ) : null}
        {meta}
      </div>
      {action ? (
        <div className="flex w-full shrink-0 flex-row flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:gap-2 [&_a]:min-h-11 sm:[&_a]:min-h-9 [&_button]:min-h-11 sm:[&_button]:min-h-9">
          {action}
        </div>
      ) : null}
    </div>
  );
}
