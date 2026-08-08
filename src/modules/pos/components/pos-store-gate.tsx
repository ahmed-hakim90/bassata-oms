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
import { PosLogoutButton } from "@/modules/pos/components/pos-logout-button";
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
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Store className="size-5 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <PosLogoutButton />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-y-contain px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-8">
        <PosSetupStepper state={readinessState} className="mb-2" />
        <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-4 shadow-lg ring-1 ring-foreground/5 max-[390px]:rounded-xl max-[390px]:p-3.5 sm:space-y-6 sm:p-6">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {stores.length === 0 ? (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-center text-sm text-muted-foreground">
              لا يوجد فرع متاح لحسابك. اطلب من المدير إضافة صلاحية فرع.
            </p>
          ) : stores.length <= 4 ? (
            <div className="grid gap-2">
              {stores.map((store) => {
                const selected = selectedId === store.id;
                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => setSelectedId(store.id)}
                    className={
                      selected
                        ? "flex min-h-14 items-center justify-between rounded-xl border-2 border-primary bg-primary/5 px-4 py-3 text-start"
                        : "flex min-h-14 items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-start hover:bg-muted/50"
                    }
                    aria-pressed={selected}
                  >
                    <span className="truncate text-base font-semibold">{store.name}</span>
                    {selected ? (
                      <span className="shrink-0 text-xs font-medium text-primary">مختار</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="pos-store">الفرع</Label>
              <Select value={selectedId} onValueChange={(value) => setSelectedId(value ?? "")}>
                <SelectTrigger id="pos-store" className="h-12 rounded-xl text-base">
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
          )}

          <Button
            className="h-14 w-full rounded-xl text-base font-semibold"
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
