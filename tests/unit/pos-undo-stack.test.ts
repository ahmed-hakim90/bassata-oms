import { beforeEach, describe, expect, it } from "vitest";
import { usePosStore } from "@/stores/pos-store";

const baseLine = {
  productId: "product-1",
  variantId: null,
  name: "Vanilla Scoop",
  quantity: 2,
  unitPrice: 5,
  modifiers: [] as { name: string; price: number }[],
  imageUrl: null,
};

describe("pos store undo stack", () => {
  beforeEach(() => {
    usePosStore.setState({
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
      undoStack: [],
    });
  });

  it("undoes an added line", () => {
    usePosStore.getState().addItem(baseLine);
    expect(usePosStore.getState().cart).toHaveLength(1);

    expect(usePosStore.getState().undoLast()).toBe(true);
    expect(usePosStore.getState().cart).toHaveLength(0);
    expect(usePosStore.getState().undoLast()).toBe(false);
  });

  it("undoes a quantity increase", () => {
    usePosStore.getState().addItem(baseLine);
    const lineId = usePosStore.getState().cart[0]!.id;
    usePosStore.getState().updateQuantity(lineId, 5);
    expect(usePosStore.getState().cart[0]!.quantity).toBe(5);

    expect(usePosStore.getState().undoLast()).toBe(true);
    expect(usePosStore.getState().cart[0]!.quantity).toBe(2);
  });

  it("undoes clearCart and restores discount + customer", () => {
    usePosStore.getState().addItem(baseLine);
    usePosStore.getState().setDiscountAmount(3);
    usePosStore.getState().setCustomer({
      id: "c1",
      org_id: "o1",
      name: "عميل",
      phone: "",
      email: null,
      total_spent: 0,
      visit_count: 0,
      account_balance: 0,
      credit_limit: 0,
      payment_terms: "",
      notes: "",
      address: "",
      tax_id: "",
      created_at: new Date().toISOString(),
    });

    usePosStore.getState().clearCart();
    expect(usePosStore.getState().cart).toHaveLength(0);
    expect(usePosStore.getState().customer).toBeNull();

    expect(usePosStore.getState().undoLast()).toBe(true);
    expect(usePosStore.getState().cart).toHaveLength(1);
    expect(usePosStore.getState().discountAmount).toBe(3);
    expect(usePosStore.getState().customer?.name).toBe("عميل");
  });

  it("does not record undo when clearCart({ undoable: false })", () => {
    usePosStore.getState().addItem(baseLine);
    usePosStore.getState().clearCart({ undoable: false });
    expect(usePosStore.getState().cart).toHaveLength(0);
    expect(usePosStore.getState().undoStack).toHaveLength(0);
    expect(usePosStore.getState().undoLast()).toBe(false);
  });
});
