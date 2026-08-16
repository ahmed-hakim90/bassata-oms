import { PosLoadingSkeleton } from "@/components/Velora/page-loading-skeleton";

export default function OperationalLoading() {
  return (
    <div className="min-h-dvh bg-[var(--mds-color-bg-canvas)] p-[var(--mds-space-4)]">
      <PosLoadingSkeleton />
    </div>
  );
}
