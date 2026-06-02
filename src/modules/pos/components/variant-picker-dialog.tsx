"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { formatCurrency } from "@/lib/format";
import type { POSProduct, POSVariant } from "@/modules/pos/services/catalog.service";

interface VariantPickerDialogProps {
  open: boolean;
  product: POSProduct | null;
  onClose: () => void;
  onSelect: (product: POSProduct, variant: POSVariant) => void;
}

export function VariantPickerDialog({
  open,
  product,
  onClose,
  onSelect,
}: VariantPickerDialogProps) {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>Choose a size or option</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {product.variants.map((variant) => (
            <Button
              key={variant.id}
              variant="outline"
              className="h-auto justify-between rounded-xl px-4 py-3"
              onClick={() => {
                onSelect(product, variant);
                onClose();
              }}
            >
              <span className="font-medium">{variant.name}</span>
              <span className="flex items-center gap-2">
                {variant.stockBadge !== "untracked" ? (
                  <StatusPill
                    label={
                      variant.stockBadge === "out"
                        ? "Out"
                        : variant.stockBadge === "low"
                          ? "Low"
                          : "In stock"
                    }
                    variant={
                      variant.stockBadge === "out"
                        ? "warning"
                        : variant.stockBadge === "low"
                          ? "info"
                          : "success"
                    }
                  />
                ) : null}
                <span className="font-semibold tabular-nums">
                  {formatCurrency(variant.price)}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
