import { describe, expect, it } from "vitest";
import type { PosHeldCartRow } from "@/lib/repositories/pos-held-cart.repository";
import { mapHeldCartRowToHeldCart } from "@/modules/pos/services/held-cart.service";

function row(overrides: Partial<PosHeldCartRow> = {}): PosHeldCartRow {
  return {
    id: "hold-1",
    org_id: "org-1",
    store_id: "store-1",
    device_id: "device-1",
    created_by: "user-1",
    name: "Mona",
    payload: {
      cart: [
        {
          id: "line-1",
          productId: "p1",
          variantId: null,
          name: "Latte",
          quantity: 1,
          unitPrice: 30,
          modifiers: [],
          lineTotal: 30,
          imageUrl: null,
        },
      ],
      customer: { id: "c1", name: "Mona", phone: "0100" },
      discountAmount: 5,
      salesMode: "retail",
    },
    created_at: "2026-07-13T12:00:00.000Z",
    updated_at: "2026-07-13T12:00:00.000Z",
    ...overrides,
  };
}

describe("held cart mapping", () => {
  it("maps a valid store+device hold payload", () => {
    const held = mapHeldCartRowToHeldCart(row());
    expect(held).toMatchObject({
      id: "hold-1",
      name: "Mona",
      discountAmount: 5,
      salesMode: "retail",
    });
    expect(held?.cart).toHaveLength(1);
    expect(held?.customer?.name).toBe("Mona");
  });

  it("rejects empty or invalid cart payloads", () => {
    expect(mapHeldCartRowToHeldCart(row({ payload: { cart: [] } }))).toBeNull();
    expect(mapHeldCartRowToHeldCart(row({ payload: { cart: "bad" } }))).toBeNull();
  });

  it("defaults unknown sales mode to retail", () => {
    const held = mapHeldCartRowToHeldCart(
      row({
        payload: {
          cart: [
            {
              id: "line-1",
              productId: "p1",
              variantId: null,
              name: "Latte",
              quantity: 1,
              unitPrice: 30,
              modifiers: [],
              lineTotal: 30,
              imageUrl: null,
            },
          ],
          salesMode: "mixed",
          discountAmount: 0,
          customer: null,
        },
      })
    );
    expect(held?.salesMode).toBe("retail");
  });
});
