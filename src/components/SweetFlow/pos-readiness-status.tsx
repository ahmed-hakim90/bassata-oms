import Link from "next/link";
import { Lock, Store, Wallet, Smartphone, LogIn } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PosReadiness } from "@/lib/auth/pos-readiness";
import {
  POS_READINESS_COPY,
  type PosReadinessState,
} from "@/lib/auth/pos-readiness-copy";

const stateIcons: Partial<
  Record<PosReadinessState, React.ComponentType<{ className?: string }>>
> = {
  login_required: LogIn,
  no_device: Smartphone,
  device_inactive: Lock,
  store_mismatch: Store,
  store_required: Store,
  access_denied: Lock,
  role_denied: Lock,
  no_session: Wallet,
  session_warning: Wallet,
  session_expired: Wallet,
  ready: Wallet,
};

interface PosReadinessStatusProps {
  readiness: PosReadiness;
  variant?: "default" | "compact";
}

export function PosReadinessStatus({
  readiness,
  variant = "default",
}: PosReadinessStatusProps) {
  if (readiness.state === "ready") return null;

  const copy = POS_READINESS_COPY[readiness.state];
  const Icon = stateIcons[readiness.state] ?? Wallet;

  if (variant === "compact") {
    return (
      <p className="text-sm text-muted-foreground">
        {copy.title} — {copy.description}
        {copy.href && copy.cta ? (
          <>
            {" "}
            <Link href={copy.href} className="font-medium text-primary underline-offset-4 hover:underline">
              {copy.cta}
            </Link>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 p-6 text-center">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">{copy.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
      {copy.href && copy.cta ? (
        <Link
          href={copy.href}
          className={cn(buttonVariants({ size: "sm" }), "mt-4 rounded-full")}
        >
          {copy.cta}
        </Link>
      ) : null}
    </div>
  );
}
