"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { selectCashierStoreAndContinueAction } from "@/modules/auth/actions/device.actions";
import { Button } from "@/components/ui/button";
import type { Store } from "@/lib/types";

interface CashierStorePickerProps {
  stores: Store[];
}

export function CashierStorePicker({ stores }: CashierStorePickerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="w-full max-w-md space-y-6 rounded-3xl border border-border/60 bg-card/80 p-8 shadow-xl">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Select branch</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose the store you are working at today.</p>
      </div>
      <div className="grid gap-2">
        {stores.map((store) => (
          <Button
            key={store.id}
            variant="outline"
            className="h-12 justify-start"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  await selectCashierStoreAndContinueAction(store.id);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not select store");
                  router.refresh();
                }
              });
            }}
          >
            {store.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
