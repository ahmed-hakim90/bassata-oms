"use client";

import { toast } from "sonner";
import { holdCartAction } from "@/modules/pos/actions/held-cart.actions";
import { playPosErrorSound, playPosSuccessSound } from "@/modules/pos/lib/pos-sounds";
import { usePosStore } from "@/stores/pos-store";

/**
 * Park the active POS cart (optimistic local hold + background server sync).
 * Shared by the تعليق button and F4 shortcut.
 */
export function holdCurrentPosCart(): boolean {
  const state = usePosStore.getState();
  if (state.cart.length === 0) return false;

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
  const payload = {
    name: state.customer?.name,
    cart: snapshot.cart,
    customer: snapshot.customer,
    discountAmount: snapshot.discountAmount,
    couponCode: snapshot.couponCode,
    salesMode: snapshot.salesMode,
  };
  const localHeld = state.holdCart(payload.name);
  if (!localHeld) return false;

  void holdCartAction(payload).then((result) => {
    if (!result.success) {
      usePosStore.setState(snapshot);
      playPosErrorSound();
      toast.error(result.error);
      return;
    }
    playPosSuccessSound();
    toast.success("تم تعليق الفاتورة");
    usePosStore.getState().reconcileHeldCartId(localHeld.id, result.heldCart);
  });

  return true;
}
