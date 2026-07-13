import { cn } from "@/lib/utils";

export const HAKIMO_PORTFOLIO_URL = "https://portfolio-hakim90.vercel.app/";

type PoweredByHakimoProps = {
  className?: string;
  /** Compact mark for tight chrome (e.g. collapsed sidebar). */
  compact?: boolean;
  /** Sidebar chrome uses sidebar muted tokens instead of page muted. */
  tone?: "default" | "sidebar";
};

export function PoweredByHakimo({
  className,
  compact = false,
  tone = "default",
}: PoweredByHakimoProps) {
  const isSidebar = tone === "sidebar";

  return (
    <a
      href={HAKIMO_PORTFOLIO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center justify-center gap-1.5 rounded-[var(--mds-radius-sm)] outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSidebar
          ? "focus-visible:ring-offset-sidebar"
          : "focus-visible:ring-offset-background",
        className
      )}
      aria-label="Powered by Hakimo"
    >
      {compact ? (
        <span
          className={cn(
            "text-[10px] font-semibold tracking-wide transition-colors group-hover:text-primary",
            isSidebar ? "text-sidebar-foreground/55" : "text-muted-foreground"
          )}
        >
          H
        </span>
      ) : (
        <>
          <span
            className={cn(
              "text-[11px] transition-colors",
              isSidebar
                ? "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                : "text-muted-foreground group-hover:text-foreground/80"
            )}
          >
            Powered by
          </span>
          <span
            className={cn(
              "text-[11px] font-semibold tracking-tight transition-colors group-hover:text-primary",
              isSidebar ? "text-sidebar-foreground/75" : "text-foreground/80"
            )}
          >
            Hakimo
          </span>
        </>
      )}
    </a>
  );
}
