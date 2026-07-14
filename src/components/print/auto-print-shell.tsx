"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";

interface AutoPrintShellProps {
  /** Rendered content when ready */
  children: ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Error message in Arabic */
  error?: string | null;
  /** Back link when error */
  backHref?: string;
  /** Back link label in Arabic */
  backLabel?: string;
  /** Auto-print delay in ms (default 350) */
  autoPrintDelayMs?: number;
}

/**
 * Shared print view shell:
 * - Shows loading/error states in Arabic
 * - Auto-triggers window.print() after short delay when ready
 * - Wraps content in print-stage for screen preview styling
 */
export function AutoPrintShell({
  children,
  loading = false,
  error = null,
  backHref = "/",
  backLabel = "رجوع",
  autoPrintDelayMs = 350,
}: AutoPrintShellProps) {
  const ready = !loading && !error;

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, autoPrintDelayMs);
    return () => window.clearTimeout(timer);
  }, [ready, autoPrintDelayMs]);

  if (error) {
    return (
      <div
        dir="rtl"
        className="grid min-h-screen place-items-center gap-4 p-6 text-center"
      >
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link
          href={backHref}
          className="rounded-xl border bg-white px-4 py-2 text-sm font-medium"
        >
          {backLabel}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        dir="rtl"
        className="grid min-h-screen place-items-center p-6 text-sm text-muted-foreground"
      >
        جاري تجهيز صفحة الطباعة…
      </div>
    );
  }

  return <div className="print-stage">{children}</div>;
}
