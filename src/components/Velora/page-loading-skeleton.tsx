import { Skeleton } from "@/components/ui/skeleton";

export function PageLoadingSkeleton({
  label = "جاري فتح الصفحة...",
}: {
  label?: string;
}) {
  return (
    <div
      className="space-y-[var(--mds-space-4)]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="space-y-1 border-b border-border/70 pb-2 sm:pb-2.5">
        <Skeleton className="h-5 w-36 sm:h-6 sm:w-44" />
        <Skeleton className="h-3 w-full max-w-md" />
      </div>
      <div className="grid grid-cols-2 gap-[var(--mds-space-3)] sm:grid-cols-4">
        <Skeleton className="h-20 rounded-[var(--mds-radius-lg)]" />
        <Skeleton className="h-20 rounded-[var(--mds-radius-lg)]" />
        <Skeleton className="h-20 rounded-[var(--mds-radius-lg)]" />
        <Skeleton className="h-20 rounded-[var(--mds-radius-lg)]" />
      </div>
      <div className="space-y-3 rounded-[var(--mds-radius-lg)] border border-border bg-card p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full max-w-56 sm:h-9" />
        </div>
        <div className="space-y-2 rounded-[var(--mds-radius-md)] border border-border p-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-5/6" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-4/5" />
        </div>
      </div>
      <p className="sr-only">{label}</p>
    </div>
  );
}

export function PosLoadingSkeleton({
  label = "جاري فتح نقطة البيع...",
}: {
  label?: string;
}) {
  return (
    <div
      className="flex min-h-[70vh] flex-col gap-[var(--mds-space-4)]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-[var(--mds-space-3)] sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-[var(--mds-radius-lg)]" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-[var(--mds-radius-lg)]" />
      <p className="sr-only">{label}</p>
    </div>
  );
}

export function AuthLoadingSkeleton({
  label = "جاري فتح الصفحة...",
}: {
  label?: string;
}) {
  return (
    <div
      className="mx-auto w-full max-w-md space-y-[var(--mds-space-4)] rounded-[var(--mds-radius-xl)] border border-border bg-card p-[var(--mds-space-6)]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <p className="sr-only">{label}</p>
    </div>
  );
}
