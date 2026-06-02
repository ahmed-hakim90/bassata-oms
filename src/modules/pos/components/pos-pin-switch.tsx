"use client";

import { useState } from "react";
import { PinPad } from "@/modules/auth/components/pin-pad";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function PosPinSwitch() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="rounded-full">
            Switch cashier
          </Button>
        }
      />
      <SheetContent side="bottom" className="rounded-t-3xl pb-8">
        <SheetHeader>
          <SheetTitle>Cashier PIN</SheetTitle>
        </SheetHeader>
        <p className="mb-4 text-sm text-muted-foreground">
          Quick switch between cashiers on this register. Does not replace sign-in.
        </p>
        <PinPad
          onSuccess={() => {
            setOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
