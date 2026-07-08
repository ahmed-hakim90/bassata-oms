"use client";

import { Lock } from "lucide-react";
import { PinPad } from "@/modules/auth/components/pin-pad";
import { PosPinSwitch } from "@/modules/pos/components/pos-pin-switch";

interface PosCashierPinGateProps {
  currentUserName?: string | null;
  onSuccess: () => void;
}

export function PosCashierPinGate({ currentUserName, onSuccess }: PosCashierPinGateProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Lock className="size-5 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">الكاشير مقفول</span>
        </div>
        <PosPinSwitch />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-lg ring-1 ring-foreground/5">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-tight">رقم PIN الكاشير</h1>
            <p className="text-sm text-muted-foreground">
              أدخل رقم PIN المكوّن من 4 أرقام لفتح نقطة البيع.
            </p>
            {currentUserName ? (
              <p className="text-xs text-muted-foreground">
                مسجّل الدخول:{" "}
                <span className="font-medium text-foreground">{currentUserName}</span>
              </p>
            ) : null}
          </div>
          <PinPad onSuccess={onSuccess} />
        </div>
      </div>
    </div>
  );
}
