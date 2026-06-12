"use client";

import { create } from "zustand";
import type { CartLine, Customer, PaymentMethod, PaymentSplit } from "@/lib/types";
import type { SalesMode } from "@/lib/constants";

export interface HeldCart {
  id: string;
  name: string;
  cart: CartLine[];
  customer: Customer | null;
  discountAmount: number;
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
  salesMode: SalesMode;
  addItem: (line: Omit<CartLine, "id" | "lineTotal"> & { id?: string }) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  setDiscountAmount: (amount: number) => void;
  setCustomer: (customer: Customer | null) => void;
  setCustomerLoyaltyBalance: (balance: number | null) => void;
  setLoyaltyRedemption: (redemption: LoyaltyRedemption | null) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setPaymentSplits: (payments: PaymentSplit[]) => void;
  setSalesMode: (mode: SalesMode) => void;
  holdCart: (name?: string) => HeldCart | null;
  resumeHeldCart: (id: string) => boolean;
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
  salesMode: "retail",

  addItem: (line) => {
    const id = line.id ?? `line-${line.productId}-${line.variantId ?? "base"}`;
    const existing = get().cart.find((c) => c.id === id);
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
      salesMode: "retail",
    }),

  setDiscountAmount: (amount) => {
    const subtotal = getCartSubtotal(get().cart);
    const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    set({ discountAmount: Math.min(safeAmount, subtotal) });
  },

  setCustomer: (customer) =>
    set({ customer, customerLoyaltyBalance: null, loyaltyRedemption: null }),

  setCustomerLoyaltyBalance: (balance) => set({ customerLoyaltyBalance: balance }),

  setLoyaltyRedemption: (redemption) => set({ loyaltyRedemption: redemption }),

  setPaymentMethod: (method) => set({ paymentMethod: method, paymentSplits: [] }),

  setPaymentSplits: (payments) => set({ paymentSplits: payments }),
  setSalesMode: (mode) => set({ salesMode: mode }),

  holdCart: (name) => {
    const state = get();
    if (state.cart.length === 0) return null;
    const heldCart: HeldCart = {
      id: `hold-${Date.now()}`,
      name: name?.trim() || `Hold ${state.heldCarts.length + 1}`,
      cart: state.cart,
      customer: state.customer,
      discountAmount: state.discountAmount,
      salesMode: state.salesMode,
      createdAt: new Date().toISOString(),
    };
    set({
      heldCarts: [heldCart, ...state.heldCarts],
      cart: [],
      customer: null,
      customerLoyaltyBalance: null,
      loyaltyRedemption: null,
      paymentMethod: "cash",
      paymentSplits: [],
      discountAmount: 0,
      salesMode: "retail",
    });
    return heldCart;
  },

  resumeHeldCart: (id) => {
    const state = get();
    const heldCart = state.heldCarts.find((h) => h.id === id);
    if (!heldCart) return false;
    const currentHold =
      state.cart.length > 0
        ? {
            id: `hold-${Date.now()}`,
            name: `Hold ${state.heldCarts.length + 1}`,
            cart: state.cart,
            customer: state.customer,
            discountAmount: state.discountAmount,
            salesMode: state.salesMode,
            createdAt: new Date().toISOString(),
          }
        : null;
    set({
      heldCarts: [
        ...(currentHold ? [currentHold] : []),
        ...state.heldCarts.filter((h) => h.id !== id),
      ],
      cart: heldCart.cart,
      customer: heldCart.customer,
      customerLoyaltyBalance: null,
      loyaltyRedemption: null,
      discountAmount: heldCart.discountAmount,
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
  return cart.reduce((s, l) => s + l.lineTotal, 0);
}

export function getCartTotal(cart: CartLine[], discountAmount: number) {
  return Math.max(0, getCartSubtotal(cart) - discountAmount);
}
