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
          <DialogDescription>اختر الحجم أو الخيار المناسب قبل الإضافة للسلة</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2.5">
          {product.variants.map((variant) => {
            const isOutOfStock = variant.stockBadge === "out";

            return (
              <Button
                key={variant.id}
                variant="outline"
                disabled={isOutOfStock}
                className="h-auto justify-between rounded-2xl border-border/70 bg-card px-4 py-3 text-start hover:border-primary/35 hover:bg-primary/5 disabled:opacity-50"
                onClick={() => {
                  onSelect(product, variant);
                  onClose();
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{variant.name}</span>
                  {variant.stockBadge !== "untracked" ? (
                    <span className="mt-1 block">
                      <StatusPill
                        label={
                          variant.stockBadge === "out"
                            ? "غير متاح"
                            : variant.stockBadge === "low"
                              ? "كمية محدودة"
                              : "متاح"
                        }
                        variant={
                          variant.stockBadge === "out"
                            ? "warning"
                            : variant.stockBadge === "low"
                              ? "info"
                              : "success"
                        }
                      />
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-sm font-bold tabular-nums text-foreground">
                  {formatCurrency(variant.price)}
                </span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
