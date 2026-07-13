import { beforeEach, describe, expect, it } from "vitest";
import { usePosStore } from "@/stores/pos-store";
import type { CartLine } from "@/lib/types";

const line: CartLine = {
  id: "line-1",
  productId: "p1",
  variantId: null,
  name: "Latte",
  quantity: 1,
  unitPrice: 20,
  modifiers: [],
  lineTotal: 20,
  imageUrl: null,
};

describe("pos-store held carts", () => {
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
      salesMode: "retail",
    });
  });

  it("applyServerHold clears cart and prepends server hold", () => {
    usePosStore.setState({ cart: [line], discountAmount: 2 });
    usePosStore.getState().applyServerHold({
      id: "uuid-hold",
      name: "Mona",
      cart: [line],
      customer: null,
      discountAmount: 2,
      salesMode: "retail",
      createdAt: "2026-07-13T12:00:00.000Z",
    });
    const state = usePosStore.getState();
    expect(state.cart).toHaveLength(0);
    expect(state.heldCarts[0]?.id).toBe("uuid-hold");
    expect(state.discountAmount).toBe(0);
  });

  it("resumeHeldCart restores cart and accepts parked replacement from server", () => {
    usePosStore.setState({
      heldCarts: [
        {
          id: "hold-a",
          name: "A",
          cart: [line],
          customer: null,
          discountAmount: 1,
          salesMode: "retail",
          createdAt: "2026-07-13T12:00:00.000Z",
        },
      ],
      cart: [{ ...line, id: "line-2", name: "Tea", lineTotal: 15, unitPrice: 15 }],
    });
    const parked = {
      id: "hold-parked",
      name: "Parked",
      cart: [{ ...line, id: "line-2", name: "Tea", lineTotal: 15, unitPrice: 15 }],
      customer: null,
      discountAmount: 0,
      salesMode: "retail" as const,
      createdAt: "2026-07-13T12:01:00.000Z",
    };
    expect(usePosStore.getState().resumeHeldCart("hold-a", parked)).toBe(true);
    const state = usePosStore.getState();
    expect(state.cart[0]?.name).toBe("Latte");
    expect(state.heldCarts.map((h) => h.id)).toEqual(["hold-parked"]);
  });
});
