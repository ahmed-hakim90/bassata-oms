import type { ReactNode } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyStateBlock({
  title,
  description,
  ctaHref,
  ctaLabel,
  action,
  className,
}: {
  title: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
  /** Optional custom action node (shown in addition to ctaHref/ctaLabel). */
  action?: ReactNode;
  className?: string;
}) {
  const hasLinkCta = Boolean(ctaHref && ctaLabel);
  const hasActions = hasLinkCta || Boolean(action);

  return (
    <div
      className={cn(
        "rounded-[var(--mds-radius-lg)] border border-dashed border-border bg-card p-[var(--mds-space-8)] text-center",
        className
      )}
    >
      <p className="text-base font-semibold">{title}</p>
      {description ? (
        <p className="mt-[var(--mds-space-1)] text-sm text-muted-foreground">{description}</p>
      ) : null}
      {hasActions ? (
        <div className="mt-[var(--mds-space-4)] flex flex-wrap items-center justify-center gap-[var(--mds-space-2)]">
          {hasLinkCta ? (
            <Link href={ctaHref!} className={buttonVariants()}>
              {ctaLabel}
            </Link>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function LoadingStateBlock({
  label = "جاري التحميل...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-[var(--mds-space-3)] rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-6)]",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-24 w-full" />
      <p className="sr-only">{label}</p>
    </div>
  );
}

export function ErrorStateBlock({
  title = "حدث خطأ ما",
  description,
  onRetry,
  retryLabel = "إعادة المحاولة",
  className,
}: {
  title?: string;
  description?: string;
  /** Optional retry handler for recoverable errors. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--mds-radius-lg)] border border-[color-mix(in_srgb,var(--mds-color-feedback-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--mds-color-feedback-danger)_6%,var(--mds-color-bg-surface))] p-[var(--mds-space-8)] text-center",
        className
      )}
      role="alert"
    >
      <p className="text-base font-semibold text-[var(--mds-color-feedback-danger)]">{title}</p>
      {description ? (
        <p className="mt-[var(--mds-space-1)] text-sm text-muted-foreground">{description}</p>
      ) : null}
      {onRetry ? (
        <div className="mt-[var(--mds-space-4)] flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
