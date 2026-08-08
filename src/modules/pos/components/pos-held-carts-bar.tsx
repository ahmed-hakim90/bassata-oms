"use client";

import { useState, useTransition } from "react";
import { Clock3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { playPosErrorSound } from "@/modules/pos/lib/pos-sounds";
import {
  discardHeldCartAction,
  resumeHeldCartAction,
} from "@/modules/pos/actions/held-cart.actions";
import { getCartSubtotal, usePosStore } from "@/stores/pos-store";

export function PosHeldCartsBar() {
  const heldCarts = usePosStore((s) => s.heldCarts);
  const resumeHeldCart = usePosStore((s) => s.resumeHeldCart);
  const removeHeldCart = usePosStore((s) => s.removeHeldCart);
  const reconcileHeldCartId = usePosStore((s) => s.reconcileHeldCartId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [heldDeleteId, setHeldDeleteId] = useState<string | null>(null);
  const [discardPending, startDiscardTransition] = useTransition();

  if (heldCarts.length === 0) return null;

  function handleResumeHeldCart(id: string) {
    const state = usePosStore.getState();
    const target = state.heldCarts.find((held) => held.id === id);
    if (!target) return;
    if (target.id.startsWith("temp-hold-")) {
      toast.error("لسه بنحفظ الفاتورة المعلّقة… حاول تاني لحظات");
      return;
    }

    const snapshot = {
      cart: [...state.cart],
      customer: state.customer,
      customerLoyaltyBalance: state.customerLoyaltyBalance,
      loyaltyRedemption: state.loyaltyRedemption,
      discountAmount: state.discountAmount,
      couponCode: state.couponCode,
      salesMode: state.salesMode,
      paymentMethod: state.paymentMethod,
      paymentSplits: [...state.paymentSplits],
      heldCarts: [...state.heldCarts],
    };

    const parkCurrent =
      state.cart.length > 0
        ? {
            name: state.customer?.name,
            cart: [...state.cart],
            customer: state.customer,
            discountAmount: state.discountAmount,
            couponCode: state.couponCode,
            salesMode: state.salesMode,
          }
        : null;

    const parkedLocal =
      parkCurrent && parkCurrent.cart.length > 0
        ? {
            id: `temp-hold-${crypto.randomUUID()}`,
            name:
              parkCurrent.name?.trim() ||
              parkCurrent.customer?.name ||
              `معلّقة ${state.heldCarts.length + 1}`,
            cart: parkCurrent.cart,
            customer: parkCurrent.customer,
            discountAmount: parkCurrent.discountAmount,
            couponCode: parkCurrent.couponCode,
            salesMode: parkCurrent.salesMode,
            createdAt: new Date().toISOString(),
          }
        : null;

    const ok = resumeHeldCart(id, parkedLocal);
    if (!ok) {
      toast.error("الفاتورة المعلّقة غير موجودة");
      return;
    }

    setPickerOpen(false);
    toast.success("تم استئناف الفاتورة");

    void resumeHeldCartAction({
      resumeId: id,
      parkCurrent,
    }).then((result) => {
      if (!result.success) {
        usePosStore.setState(snapshot);
        playPosErrorSound();
        toast.error(result.error);
        return;
      }
      if (parkedLocal && result.parked) {
        reconcileHeldCartId(parkedLocal.id, result.parked);
      }
    });
  }

  function closePickerIfEmpty() {
    if (usePosStore.getState().heldCarts.length === 0) {
      setPickerOpen(false);
    }
  }

  function handleDiscardHeldCart(id: string) {
    if (id.startsWith("temp-hold-")) {
      removeHeldCart(id);
      closePickerIfEmpty();
      return;
    }
    startDiscardTransition(async () => {
      const result = await discardHeldCartAction(id);
      if (!result.success) {
        playPosErrorSound();
        toast.error(result.error);
        return;
      }
      removeHeldCart(id);
      closePickerIfEmpty();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-11 shrink-0 justify-center gap-1.5 rounded-xl border-orange-200 bg-orange-50 px-2.5 text-sm font-semibold text-orange-950 hover:bg-orange-100 sm:h-10 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/20"
        onClick={() => setPickerOpen(true)}
        aria-label={`فواتير معلّقة: ${heldCarts.length}`}
      >
        <Clock3 className="size-4 shrink-0" />
        <span className="truncate max-[390px]:sr-only">فواتير معلّقة</span>
        <span className="rounded-full bg-orange-700 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums dark:bg-orange-400 dark:text-orange-950">
          {heldCarts.length}
        </span>
      </Button>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[92dvh] max-w-lg overflow-hidden rounded-2xl p-0 sm:max-w-lg">
          <DialogHeader className="space-y-2 border-b border-border/70 px-4 py-4 text-start">
            <div className="flex size-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-800 dark:text-orange-200">
              <Clock3 className="size-5" />
            </div>
            <DialogTitle>فواتير معلّقة</DialogTitle>
            <DialogDescription>
              اختار فاتورة للاستئناف — الفاتورة الحالية هتتعلّق تلقائي لو فيها أصناف
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-[min(70dvh,560px)] space-y-2 overflow-y-auto px-4 py-4">
            {heldCarts.map((held) => {
              const itemCount = held.cart.length;
              const subtotal = getCartSubtotal(held.cart);
              const saving = held.id.startsWith("temp-hold-");
              return (
                <li key={held.id}>
                  <div className="flex items-stretch gap-1.5 rounded-xl border border-border/70 bg-background p-1.5">
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-lg px-2.5 py-2.5 text-start transition-colors hover:bg-muted/60 disabled:opacity-60"
                      onClick={() => handleResumeHeldCart(held.id)}
                      disabled={saving || discardPending}
                    >
                      <p className="truncate text-sm font-semibold">{held.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {saving
                          ? "جاري الحفظ…"
                          : [
                              held.customer?.name,
                              `${itemCount} صنف`,
                              formatCurrency(subtotal),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </p>
                      {!saving && held.createdAt ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                          {formatDateTime(held.createdAt)}
                        </p>
                      ) : null}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 self-center rounded-xl text-muted-foreground hover:text-destructive"
                      aria-label={`حذف ${held.name}`}
                      disabled={discardPending}
                      onClick={() => setHeldDeleteId(held.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(heldDeleteId)}
        onOpenChange={(open) => {
          if (!open) setHeldDeleteId(null);
        }}
        title="حذف الفاتورة المعلّقة؟"
        description="هتتمسح الفاتورة المعلّقة ومش هتقدر ترجعها."
        confirmLabel="حذف"
        destructive
        onConfirm={() => {
          if (heldDeleteId) handleDiscardHeldCart(heldDeleteId);
          setHeldDeleteId(null);
        }}
      />
    </>
  );
}
