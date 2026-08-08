import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ResponsiveListLayoutProps = {
  /** Mobile card list (&lt; md) */
  mobile: ReactNode;
  /** Desktop table / dense layout (≥ md) */
  desktop: ReactNode;
  className?: string;
  /** Gap between mobile cards — default matches sessions/purchases */
  mobileClassName?: string;
};

/**
 * Dual layout shell: cards on phone, table (or denser UI) from md up.
 * Single place for the `md:hidden` / `hidden md:block` split.
 */
export function ResponsiveListLayout({
  mobile,
  desktop,
  className,
  mobileClassName,
}: ResponsiveListLayoutProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className={cn("grid gap-3 md:hidden", mobileClassName)}>{mobile}</div>
      <div className="hidden md:block">{desktop}</div>
    </div>
  );
}
