"use client";

import { AlertTriangle } from "lucide-react";
import { PosPinSwitch } from "@/modules/pos/components/pos-pin-switch";
import {
  POS_READINESS_COPY,
  type PosReadinessState,
} from "@/lib/auth/pos-readiness-copy";

interface PosAccessDeniedProps {
  state: PosReadinessState;
}

export function PosAccessDenied({ state }: PosAccessDeniedProps) {
  const copy = POS_READINESS_COPY[state];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-end gap-3 border-b px-4 py-3">
        <PosPinSwitch />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">{copy.title}</h1>
            <p className="text-sm text-muted-foreground">{copy.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
