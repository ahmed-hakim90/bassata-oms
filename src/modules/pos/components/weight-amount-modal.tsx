"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { POSProduct } from "@/modules/pos/services/catalog.service";
import { amountFromQuantity, quantityFromAmount } from "@/lib/units";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: POSProduct | null;
  onConfirm: (input: {
    quantity: number;
    unitPrice: number;
    saleInputMode: "by_weight" | "by_amount";
    enteredAmount?: number;
  }) => void;
}

export function WeightAmountModal({ open, onOpenChange, product, onConfirm }: Props) {
  const [mode, setMode] = useState<"by_weight" | "by_amount">("by_weight");
  const [weight, setWeight] = useState("");
  const [amount, setAmount] = useState("");

  const unitPrice = product?.base_price ?? 0;
  const quantity = useMemo(() => {
    if (mode === "by_weight") return Number(weight || 0);
    return quantityFromAmount(Number(amount || 0), unitPrice);
  }, [mode, weight, amount, unitPrice]);
  const total = amountFromQuantity(quantity, unitPrice);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product?.name ?? "Weight sale"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="inline-flex rounded-xl border p-1">
            <Button size="sm" variant={mode === "by_weight" ? "default" : "ghost"} onClick={() => setMode("by_weight")}>
              Sell by weight
            </Button>
            <Button size="sm" variant={mode === "by_amount" ? "default" : "ghost"} onClick={() => setMode("by_amount")}>
              Sell by amount
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Unit price: {unitPrice} / {product?.sale_unit ?? "kg"}
          </p>
          {mode === "by_weight" ? (
            <Input
              type="number"
              step="0.001"
              placeholder="Weight"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          ) : (
            <Input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
          <p className="text-sm">Calculated quantity: {quantity.toFixed(3)} {product?.sale_unit ?? "kg"}</p>
          <p className="text-sm">Total: {total.toFixed(2)}</p>
          <Button
            className="w-full"
            disabled={quantity <= 0}
            onClick={() =>
              onConfirm({
                quantity,
                unitPrice,
                saleInputMode: mode,
                enteredAmount: mode === "by_amount" ? Number(amount || 0) : undefined,
              })
            }
          >
            Add to cart
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
