"use client";

import { useState, useTransition } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { registerBrowserDeviceAction } from "@/modules/auth/actions/device.actions";
import { DevicePairForm } from "@/modules/auth/components/device-pair-form";
import { Button } from "@/components/ui/button";
import { PosPinSwitch } from "@/modules/pos/components/pos-pin-switch";
import type { Device } from "@/lib/repositories/device.repository";

interface PosDeviceGateProps {
  devices?: Device[];
}

export function PosDeviceGate({ devices = [] }: PosDeviceGateProps) {
  const [showPairingCode, setShowPairingCode] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleUseDevice(deviceId: string) {
    startTransition(async () => {
      const result = await registerBrowserDeviceAction(deviceId);
      if (result.success) {
        toast.success("تم ربط هذا المتصفح بالكاشير");
        // Full navigation so new device/store cookies are applied before /pos renders.
        window.location.assign("/pos");
        return;
      }
      toast.error(result.error ?? "تعذر ربط الجهاز");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-end gap-3 border-b px-4 py-3">
        <PosPinSwitch />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-lg">
          <div className="space-y-2 text-center">
            <Smartphone className="mx-auto size-10 text-primary" />
            <h1 className="text-xl font-semibold">ربط نقطة البيع</h1>
            <p className="text-sm text-muted-foreground">
              اضغط زر واحد لاستخدام كاشير هذا الفرع من هذا المتصفح.
            </p>
          </div>

          {devices.length > 0 ? (
            <div className="space-y-2">
              {devices.map((device) => (
                <Button
                  key={device.id}
                  type="button"
                  className="h-12 w-full rounded-xl text-base"
                  disabled={pending}
                  onClick={() => handleUseDevice(device.id)}
                >
                  استخدم {device.name}
                </Button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-center text-sm text-muted-foreground">
              لا يوجد جهاز كاشير على هذا الفرع. اطلب من المدير إضافة جهاز من الإعدادات.
            </p>
          )}

          <div className="space-y-3 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setShowPairingCode((value) => !value)}
            >
              {showPairingCode ? "إخفاء كود الاقتران" : "عندي كود اقتران"}
            </Button>
            {showPairingCode ? <DevicePairForm returnTo="/pos" /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
