"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
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

function formatWeightPreview(quantityKg: number, unit: string): string {
  if (unit === "kg" || unit === "gram") {
    const grams = Math.round(quantityKg * 1000);
    return `${quantityKg.toFixed(3)} كجم ≈ ${grams} جرام`;
  }
  return `${quantityKg.toFixed(3)} ${unit}`;
}

export function WeightAmountModal({ open, onOpenChange, product, onConfirm }: Props) {
  const allowAmount = product?.supports_amount_sale === true;
  const [mode, setMode] = useState<"by_weight" | "by_amount">("by_weight");
  const [weight, setWeight] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!open || !product) return;
    setMode(product.supports_amount_sale === true ? "by_amount" : "by_weight");
    setWeight("");
    setAmount("");
  }, [open, product]);

  const unitPrice = product?.base_price ?? 0;
  const unit = product?.sale_unit ?? "kg";
  const quantity = useMemo(() => {
    if (mode === "by_weight") return Number(weight || 0);
    return quantityFromAmount(Number(amount || 0), unitPrice);
  }, [mode, weight, amount, unitPrice]);
  const total = amountFromQuantity(quantity, unitPrice);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product?.name ?? "بيع بالوزن"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="inline-flex rounded-xl border p-1">
            <Button
              size="sm"
              variant={mode === "by_weight" ? "default" : "ghost"}
              className="rounded-lg"
              onClick={() => setMode("by_weight")}
            >
              بالوزن
            </Button>
            {allowAmount ? (
              <Button
                size="sm"
                variant={mode === "by_amount" ? "default" : "ghost"}
                className="rounded-lg"
                onClick={() => setMode("by_amount")}
              >
                بالمبلغ
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            سعر الوحدة: {formatCurrency(unitPrice)} / {unit}
          </p>
          {mode === "by_weight" ? (
            <div className="space-y-2">
              <Label htmlFor="pos-weight-input">الوزن ({unit})</Label>
              <Input
                id="pos-weight-input"
                type="number"
                step="0.001"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="h-11 rounded-xl"
                inputMode="decimal"
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="pos-amount-input">المبلغ اللي العميل عايزه</Label>
              <Input
                id="pos-amount-input"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 rounded-xl"
                inputMode="decimal"
                autoFocus
              />
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            الكمية: {quantity > 0 ? formatWeightPreview(quantity, unit) : "—"}
          </p>
          <div className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">الإجمالي</p>
            <p className="text-xl font-bold tabular-nums tracking-tight text-foreground">
              {formatCurrency(total)}
            </p>
          </div>
          <Button
            className="h-14 w-full rounded-2xl text-base font-semibold"
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
            إضافة للسلة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
