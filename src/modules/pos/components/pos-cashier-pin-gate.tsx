"use client";

import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { PinPad } from "@/modules/auth/components/pin-pad";
import { PosLogoutButton } from "@/modules/pos/components/pos-logout-button";

interface PosCashierPinGateProps {
  currentUserName?: string | null;
  onSuccess?: () => void;
}

export function PosCashierPinGate({ currentUserName, onSuccess }: PosCashierPinGateProps) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Lock className="size-5 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">الكاشير مقفول</span>
        </div>
        <PosLogoutButton />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-y-contain px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-8">
        <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-4 shadow-lg ring-1 ring-foreground/5 max-[390px]:rounded-xl max-[390px]:p-3 sm:space-y-6 sm:p-6">
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
          <PinPad
            onSuccess={() => {
              onSuccess?.();
              router.refresh();
            }}
          />
        </div>
      </div>
    </div>
  );
}
