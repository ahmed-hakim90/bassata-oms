import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function EmptyStateBlock({
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <p className="text-base font-semibold">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} className={buttonVariants({ className: "mt-4" })}>
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function LoadingStateBlock({ label = "جاري التحميل..." }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function ErrorStateBlock({
  title = "حدث خطأ ما",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <p className="text-base font-semibold text-destructive">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
