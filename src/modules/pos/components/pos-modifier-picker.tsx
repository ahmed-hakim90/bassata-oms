"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingStateBlock } from "@/components/Velora/state-blocks";
import { listActiveModifiersForPosAction } from "@/modules/products/actions/product-modifiers.actions";
import type { ProductModifierGroup } from "@/modules/products/services/product-modifiers.service";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PosModifierPicker(props: {
  open: boolean;
  productName: string;
  productId: string;
  currency: string;
  onClose: () => void;
  onConfirm: (modifiers: { name: string; price: number }[]) => void;
}) {
  const [groups, setGroups] = useState<ProductModifierGroup[]>([]);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setLoading(true);
    setSelected({});
    void listActiveModifiersForPosAction(props.productId)
      .then((next) => {
        setGroups(next);
        if (next.length === 0) {
          props.onConfirm([]);
          props.onClose();
        }
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "فشل تحميل الإضافات");
        props.onClose();
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/productId drive load
  }, [props.open, props.productId]);

  function toggle(groupId: string, modifierId: string, maxSelect: number) {
    setSelected((prev) => {
      const current = new Set(prev[groupId] ?? []);
      if (current.has(modifierId)) {
        current.delete(modifierId);
      } else {
        if (current.size >= maxSelect) {
          if (maxSelect === 1) current.clear();
          else return prev;
        }
        current.add(modifierId);
      }
      return { ...prev, [groupId]: current };
    });
  }

  function confirm() {
    for (const group of groups) {
      const count = selected[group.id]?.size ?? 0;
      if (count < group.minSelect) {
        toast.error(`اختر على الأقل ${group.minSelect} من «${group.name}»`);
        return;
      }
    }
    const mods: { name: string; price: number }[] = [];
    for (const group of groups) {
      const ids = selected[group.id] ?? new Set();
      for (const mod of group.modifiers) {
        if (ids.has(mod.id)) {
          mods.push({ name: mod.name, price: mod.priceDelta });
        }
      }
    }
    props.onConfirm(mods);
    props.onClose();
  }

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-h-[min(92dvh,100%)] max-w-md overflow-hidden p-0 max-sm:max-w-[calc(100%-0.75rem)] sm:max-w-md">
        <DialogHeader className="border-b border-border/60 px-4 py-3 text-start">
          <DialogTitle className="text-base sm:text-lg">
            إضافات — {props.productName}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <LoadingStateBlock
            label="جاري التحميل…"
            className="mx-4 my-4 border-0 shadow-none"
          />
        ) : (
          <div className="max-h-[min(55dvh,22rem)] space-y-4 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4">
            {groups.map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="text-sm font-semibold">
                  {group.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({group.minSelect}–{group.maxSelect})
                  </span>
                </p>
                <ul className="space-y-1.5">
                  {group.modifiers.map((mod) => {
                    const checked = selected[group.id]?.has(mod.id) ?? false;
                    return (
                      <li key={mod.id}>
                        <label
                          className={cn(
                            "flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition active:scale-[0.99]",
                            checked
                              ? "border-primary/50 bg-primary/5"
                              : "border-border/70 bg-card hover:bg-muted/40"
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                toggle(group.id, mod.id, group.maxSelect)
                              }
                            />
                            <span className="truncate font-medium">{mod.name}</span>
                          </span>
                          <span dir="ltr" className="shrink-0 tabular-nums text-muted-foreground">
                            {mod.priceDelta === 0
                              ? "—"
                              : formatCurrency(mod.priceDelta, props.currency)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        <DialogFooter className="mx-0 mb-0 border-t border-border/60 px-3 py-3 sm:px-4">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl"
            onClick={props.onClose}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            className="h-12 rounded-xl font-semibold"
            onClick={confirm}
            disabled={loading}
          >
            إضافة للسلة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
