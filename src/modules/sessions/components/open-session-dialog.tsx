"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openSessionAction } from "@/modules/sessions/actions/session.actions";

export function OpenSessionDialog({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [cash, setCash] = useState("100");
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    const amount = parseFloat(cash);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error("Enter a valid opening float");
      return;
    }
    startTransition(async () => {
      try {
        await openSessionAction(amount);
        toast.success("Session opened");
        setOpen(false);
        window.location.reload();
      } catch {
        toast.error("Could not open session");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        className="rounded-xl"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Open session
      </Button>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open cashier session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="opening-cash">Opening cash float</Label>
            <Input
              id="opening-cash"
              type="number"
              min={0}
              step="0.01"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button
            className="w-full rounded-xl"
            disabled={pending}
            onClick={handleOpen}
          >
            {pending ? "Opening…" : "Start session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
