import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertedOrders: unknown[] = [];
  const insertedItems: unknown[] = [];
  const admin = {
    from: vi.fn((table: string) => {
      if (table === "stores") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "store-1",
              org_id: "org-1",
              name: "Downtown",
              is_active: true,
              settings: {
                online_menu_enabled: true,
                online_menu_ordering_enabled: true,
              },
            },
            error: null,
          }),
        };
      }

      if (table === "products") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: "product-1",
                org_id: "org-1",
                name: "Latte",
                base_price: 50,
                sale_price: 45,
                is_active: true,
                product_type: "finished",
                inventory_product_type: "finished_product",
              },
            ],
            error: null,
          }),
        };
      }

      if (table === "product_variants") {
        const builder = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn((column: string) => {
            if (column === "id") {
              return Promise.resolve({
                data: [
                  {
                    id: "variant-1",
                    product_id: "product-1",
                    name: "Medium",
                    price: null,
                    price_delta: 0,
                    is_active: true,
                  },
                ],
                error: null,
              });
            }
            return builder;
          }),
          eq: vi.fn().mockResolvedValue({
            data: [{ id: "variant-1", product_id: "product-1", is_active: true }],
            error: null,
          }),
        };
        return {
          ...builder,
        };
      }

      if (table === "customers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === "online_orders") {
        return {
          insert: vi.fn((payload) => {
            insertedOrders.push(payload);
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: "online-1", total: payload.total },
                error: null,
              }),
            };
          }),
        };
      }

      if (table === "online_order_items") {
        return {
          insert: vi.fn((payload) => {
            insertedItems.push(payload);
            return { error: null };
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
  return { admin, insertedOrders, insertedItems };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mocks.admin),
}));

describe("submitPublicOnlineOrder", () => {
  beforeEach(() => {
    mocks.insertedOrders.length = 0;
    mocks.insertedItems.length = 0;
    mocks.admin.from.mockClear();
  });

  it("recalculates prices server-side and stores a pending online order", async () => {
    const { submitPublicOnlineOrder } = await import(
      "@/modules/online-orders/services/online-order.service"
    );

    const result = await submitPublicOnlineOrder({
      slug: "downtown",
      customerName: "Mona",
      customerPhone: "01000000000",
      notes: "No sugar",
      lines: [{ productId: "product-1", variantId: "variant-1", quantity: 2 }],
    });

    expect(result).toEqual({ id: "online-1", total: 90, storeName: "Downtown" });
    expect(mocks.insertedOrders[0]).toMatchObject({
      store_id: "store-1",
      customer_name: "Mona",
      customer_phone: "01000000000",
      notes: "No sugar",
      status: "pending",
      subtotal: 90,
      total: 90,
    });
    expect(mocks.insertedItems[0]).toEqual([
      {
        online_order_id: "online-1",
        product_id: "product-1",
        variant_id: "variant-1",
        product_name: "Latte",
        variant_name: "Medium",
        quantity: 2,
        unit_price: 45,
        line_total: 90,
      },
    ]);
  });
});
