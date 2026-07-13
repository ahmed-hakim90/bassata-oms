"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { setActiveStoreAction } from "@/modules/auth/actions/set-store.action";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PosPinSwitch } from "@/modules/pos/components/pos-pin-switch";
import { PosSetupStepper } from "@/modules/pos/components/pos-setup-stepper";
import { selectLabelById } from "@/lib/select-label";
import type { Store as StoreType } from "@/lib/types";

interface PosStoreGateProps {
  stores: StoreType[];
  activeStoreId?: string | null;
  title?: string;
  description?: string;
  /** Explicit readiness for stepper — do not infer from title copy. */
  readinessState?: "store_required" | "store_mismatch";
}

export function PosStoreGate({
  stores,
  activeStoreId,
  title = "اختيار الفرع",
  description = "اختر الفرع الذي ستعمل عليه في نقطة البيع.",
  readinessState = "store_required",
}: PosStoreGateProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(activeStoreId ?? stores[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function handleContinue() {
    if (!selectedId) {
      toast.error("اختر فرعًا للمتابعة");
      return;
    }
    startTransition(async () => {
      try {
        await setActiveStoreAction(selectedId);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر اختيار الفرع");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Store className="size-5 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <PosPinSwitch />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8">
        <PosSetupStepper state={readinessState} className="mb-2" />
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-lg ring-1 ring-foreground/5">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pos-store">الفرع</Label>
            <Select value={selectedId} onValueChange={(value) => setSelectedId(value ?? "")}>
              <SelectTrigger id="pos-store" className="h-11 rounded-xl">
                <SelectValue placeholder="اختر الفرع">
                  {(value) => selectLabelById(stores, value, (s) => s.name)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id} label={store.name}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="h-11 w-full rounded-xl"
            disabled={pending || !selectedId}
            onClick={handleContinue}
          >
            {pending ? "جاري الحفظ…" : "متابعة"}
          </Button>
        </div>
      </div>
    </div>
  );
}
