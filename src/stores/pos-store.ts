"use client";

import { create } from "zustand";
import { computePosCartTotals, rawCartSubtotal } from "@/modules/pos/lib/cart-totals";
import type { CartLine, Customer, PaymentMethod, PaymentSplit } from "@/lib/types";
import type { SalesMode } from "@/lib/constants";

export interface HeldCart {
  id: string;
  name: string;
  cart: CartLine[];
  customer: Customer | null;
  discountAmount: number;
  couponCode: string;
  salesMode: SalesMode;
  createdAt: string;
}

export interface LoyaltyRedemption {
  points: number;
  amount: number;
}

interface PosState {
  cart: CartLine[];
  heldCarts: HeldCart[];
  customer: Customer | null;
  customerLoyaltyBalance: number | null;
  loyaltyRedemption: LoyaltyRedemption | null;
  paymentMethod: PaymentMethod;
  paymentSplits: PaymentSplit[];
  discountAmount: number;
  couponCode: string;
  salesMode: SalesMode;
  addItem: (line: Omit<CartLine, "id" | "lineTotal"> & { id?: string }) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  setDiscountAmount: (amount: number) => void;
  setCouponCode: (code: string) => void;
  setCustomer: (customer: Customer | null) => void;
  setCustomerLoyaltyBalance: (balance: number | null) => void;
  setLoyaltyRedemption: (redemption: LoyaltyRedemption | null) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setPaymentSplits: (payments: PaymentSplit[]) => void;
  setSalesMode: (mode: SalesMode) => void;
  setHeldCarts: (heldCarts: HeldCart[]) => void;
  applyServerHold: (heldCart: HeldCart) => void;
  /** Replace a temp optimistic hold id with the server-persisted row. */
  reconcileHeldCartId: (tempId: string, heldCart: HeldCart) => void;
  holdCart: (name?: string) => HeldCart | null;
  resumeHeldCart: (id: string, parkedReplacement?: HeldCart | null) => boolean;
  removeHeldCart: (id: string) => void;
}

function calcLineTotal(
  quantity: number,
  unitPrice: number,
  modifiers: { name: string; price: number }[]
) {
  const modTotal = modifiers.reduce((s, m) => s + m.price, 0);
  return (unitPrice + modTotal) * quantity;
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  heldCarts: [],
  customer: null,
  customerLoyaltyBalance: null,
  loyaltyRedemption: null,
  paymentMethod: "cash",
  paymentSplits: [],
  discountAmount: 0,
  couponCode: "",
  salesMode: "retail",

  addItem: (line) => {
    const isWeightOrAmountLine =
      line.saleInputMode === "by_weight" || line.saleInputMode === "by_amount";
    const id =
      line.id ??
      (isWeightOrAmountLine
        ? `line-${line.productId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        : `line-${line.productId}-${line.variantId ?? "base"}`);
    const existing = !isWeightOrAmountLine
      ? get().cart.find((c) => c.id === id)
      : undefined;
    if (existing) {
      set({
        cart: get().cart.map((c) =>
          c.id === id
            ? {
                ...c,
                quantity: c.quantity + line.quantity,
                lineTotal: calcLineTotal(
                  c.quantity + line.quantity,
                  c.unitPrice,
                  c.modifiers
                ),
              }
            : c
        ),
      });
      return;
    }
    const lineTotal = calcLineTotal(line.quantity, line.unitPrice, line.modifiers);
    set({
      cart: [
        ...get().cart,
        {
          id,
          productId: line.productId,
          variantId: line.variantId,
          name: line.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          modifiers: line.modifiers,
          lineTotal,
          imageUrl: line.imageUrl,
          saleUnit: line.saleUnit,
          saleInputMode: line.saleInputMode,
          enteredAmount: line.enteredAmount,
          tierId: line.tierId,
          wholesaleApplied: line.wholesaleApplied,
        },
      ],
    });
  },

  updateQuantity: (lineId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(lineId);
      return;
    }
    set({
      cart: get().cart.map((c) =>
        c.id === lineId
          ? {
              ...c,
              quantity,
              lineTotal: calcLineTotal(quantity, c.unitPrice, c.modifiers),
            }
          : c
      ),
    });
  },

  removeItem: (lineId) => {
    set({ cart: get().cart.filter((c) => c.id !== lineId) });
  },

  clearCart: () =>
    set({
      cart: [],
      customer: null,
      customerLoyaltyBalance: null,
      loyaltyRedemption: null,
      paymentMethod: "cash",
      paymentSplits: [],
      discountAmount: 0,
      couponCode: "",
      salesMode: "retail",
    }),

  setDiscountAmount: (amount) => {
    const subtotal = getCartSubtotal(get().cart);
    const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    set({ discountAmount: Math.min(safeAmount, subtotal) });
  },

  setCouponCode: (code) => set({ couponCode: code }),

  setCustomer: (customer) =>
    set({ customer, customerLoyaltyBalance: null, loyaltyRedemption: null }),

  setCustomerLoyaltyBalance: (balance) => set({ customerLoyaltyBalance: balance }),

  setLoyaltyRedemption: (redemption) => set({ loyaltyRedemption: redemption }),

  setPaymentMethod: (method) => set({ paymentMethod: method, paymentSplits: [] }),

  setPaymentSplits: (payments) => set({ paymentSplits: payments }),
  setSalesMode: (mode) => set({ salesMode: mode }),

  setHeldCarts: (heldCarts) => set({ heldCarts }),

  /** Clear active cart and prepend hold (optimistic or after server save). */
  applyServerHold: (heldCart) => {
    set({
      heldCarts: [heldCart, ...get().heldCarts.filter((h) => h.id !== heldCart.id)],
      cart: [],
      customer: null,
      customerLoyaltyBalance: null,
      loyaltyRedemption: null,
      paymentMethod: "cash",
      paymentSplits: [],
      discountAmount: 0,
      couponCode: "",
      salesMode: "retail",
    });
  },

  reconcileHeldCartId: (tempId, heldCart) => {
    set({
      heldCarts: get().heldCarts.map((h) => (h.id === tempId ? heldCart : h)),
    });
  },

  /** Optimistic local hold — sync to server in the background from the UI. */
  holdCart: (name) => {
    const state = get();
    if (state.cart.length === 0) return null;
    const heldCart: HeldCart = {
      id: `temp-hold-${crypto.randomUUID()}`,
      name: name?.trim() || `معلّقة ${state.heldCarts.length + 1}`,
      cart: state.cart,
      customer: state.customer,
      discountAmount: state.discountAmount,
      couponCode: state.couponCode,
      salesMode: state.salesMode,
      createdAt: new Date().toISOString(),
    };
    get().applyServerHold(heldCart);
    return heldCart;
  },

  resumeHeldCart: (id, parkedReplacement = null) => {
    const state = get();
    const heldCart = state.heldCarts.find((h) => h.id === id);
    if (!heldCart) return false;
    set({
      heldCarts: [
        ...(parkedReplacement ? [parkedReplacement] : []),
        ...state.heldCarts.filter((h) => h.id !== id),
      ],
      cart: heldCart.cart,
      customer: heldCart.customer,
      customerLoyaltyBalance: null,
      loyaltyRedemption: null,
      discountAmount: heldCart.discountAmount,
      couponCode: heldCart.couponCode ?? "",
      salesMode: heldCart.salesMode,
      paymentMethod: "cash",
      paymentSplits: [],
    });
    return true;
  },

  removeHeldCart: (id) => {
    set({ heldCarts: get().heldCarts.filter((h) => h.id !== id) });
  },
}));

export function getCartSubtotal(cart: CartLine[]) {
  return rawCartSubtotal(cart);
}

export function getCartTotal(cart: CartLine[], discountAmount: number) {
  return computePosCartTotals({ cart, discountAmount }).payableBeforeLoyalty;
}
