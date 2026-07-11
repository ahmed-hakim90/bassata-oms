"use client";

import { cn } from "@/lib/utils";
import type { PosReadinessState } from "@/lib/auth/pos-readiness-copy";

const SETUP_STEPS = [
  { id: "device", label: "الجهاز" },
  { id: "store", label: "الفرع" },
  { id: "session", label: "الجلسة" },
] as const;

function activeStepIndex(state: PosReadinessState): number {
  if (state === "no_device" || state === "device_inactive") return 0;
  if (
    state === "store_required" ||
    state === "store_mismatch" ||
    state === "access_denied" ||
    state === "role_denied"
  ) {
    return 1;
  }
  return 2;
}

interface PosSetupStepperProps {
  state: PosReadinessState;
  className?: string;
}

export function PosSetupStepper({ state, className }: PosSetupStepperProps) {
  const active = activeStepIndex(state);

  return (
    <div className={cn("mx-auto w-full max-w-md", className)}>
      <ol className="mb-6 flex items-center gap-2">
        {SETUP_STEPS.map((step, index) => {
          const done = index < active;
          const current = index === active;
          return (
            <li
              key={step.id}
              className="flex flex-1 flex-col items-center gap-2"
              aria-current={current ? "step" : undefined}
            >
              <div
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  done || current ? "bg-primary" : "bg-muted"
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  current ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {index + 1}. {step.label}
              </span>
              {current ? (
                <span className="sr-only">
                  الخطوة {index + 1} من {SETUP_STEPS.length}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
