"use client";

import Link from "next/link";
import { AlertTriangle, Lock, Wallet, Smartphone, Store, LogIn } from "lucide-react";
import {
  POS_READINESS_COPY,
  type PosReadinessState,
} from "@/lib/auth/pos-readiness-copy";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const icons: Partial<
  Record<PosReadinessState, React.ComponentType<{ className?: string }>>
> = {
  login_required: LogIn,
  no_device: Smartphone,
  device_inactive: Lock,
  store_mismatch: Store,
  store_required: Store,
  access_denied: Lock,
  cashier_required: Lock,
  no_session: Wallet,
  session_warning: AlertTriangle,
  session_expired: AlertTriangle,
};

interface PosReadinessBannerProps {
  state: PosReadinessState;
}

export function PosReadinessBanner({ state }: PosReadinessBannerProps) {
  if (state === "ready" || state === "cashier_required") return null;

  const copy = POS_READINESS_COPY[state];
  const Icon = icons[state];
  const isExpired = state === "session_expired";

  return (
    <div
      className={cn(
        "flex shrink-0 flex-1 items-center justify-between gap-3 rounded-2xl border px-4 py-3",
        isExpired
          ? "border-destructive/40 bg-destructive/10"
          : "border-amber-500/30 bg-amber-500/10"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <Icon
            className={cn(
              "size-5 shrink-0",
              isExpired ? "text-destructive" : "text-amber-700 dark:text-amber-300"
            )}
          />
        ) : null}
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-semibold",
              isExpired ? "text-destructive" : "text-amber-900 dark:text-amber-200"
            )}
          >
            {copy.title}
          </p>
          <p
            className={cn(
              "text-xs",
              isExpired ? "text-destructive/90" : "text-amber-800/90 dark:text-amber-200/90"
            )}
          >
            {copy.description}
          </p>
        </div>
      </div>
      {copy.href && copy.cta ? (
        <Link
          href={copy.href}
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "shrink-0 rounded-full"
          )}
        >
          {copy.cta}
        </Link>
      ) : null}
    </div>
  );
}
