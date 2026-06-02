import { beforeEach, describe, expect, it } from "vitest";
import { getCartTotal, usePosStore } from "@/stores/pos-store";

const baseLine = {
  productId: "product-1",
  variantId: null,
  name: "Vanilla Scoop",
  quantity: 2,
  unitPrice: 5,
  modifiers: [],
  imageUrl: null,
};

describe("pos store cart controls", () => {
  beforeEach(() => {
    usePosStore.setState({
      cart: [],
      heldCarts: [],
      customer: null,
      paymentMethod: "cash",
      paymentSplits: [],
      discountAmount: 0,
    });
  });

  it("clamps discount to the current subtotal", () => {
    usePosStore.getState().addItem(baseLine);
    usePosStore.getState().setDiscountAmount(50);

    expect(usePosStore.getState().discountAmount).toBe(10);
    expect(getCartTotal(usePosStore.getState().cart, usePosStore.getState().discountAmount)).toBe(0);
  });

  it("holds and resumes a cart with its discount", () => {
    usePosStore.getState().addItem(baseLine);
    usePosStore.getState().setDiscountAmount(3);

    const held = usePosStore.getState().holdCart("Table 4");

    expect(held?.name).toBe("Table 4");
    expect(usePosStore.getState().cart).toHaveLength(0);
    expect(usePosStore.getState().heldCarts).toHaveLength(1);

    const resumed = usePosStore.getState().resumeHeldCart(held!.id);

    expect(resumed).toBe(true);
    expect(usePosStore.getState().cart).toHaveLength(1);
    expect(usePosStore.getState().discountAmount).toBe(3);
    expect(usePosStore.getState().heldCarts).toHaveLength(0);
  });

  it("clears split payments when switching payment method", () => {
    usePosStore.getState().setPaymentSplits([{ method: "cash", amount: 4 }]);
    usePosStore.getState().setPaymentMethod("card");

    expect(usePosStore.getState().paymentMethod).toBe("card");
    expect(usePosStore.getState().paymentSplits).toEqual([]);
  });
});
