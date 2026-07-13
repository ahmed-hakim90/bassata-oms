import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertedOrders: unknown[] = [];
  const insertedItems: unknown[] = [];

  function defaultFrom(table: string) {
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
            timezone: "Africa/Cairo",
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
              show_on_online_menu: true,
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
              data: { id: "550e8400-e29b-41d4-a716-446655440000", total: payload.total },
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
  }

  const admin = {
    from: vi.fn(defaultFrom),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return { admin, insertedOrders, insertedItems, defaultFrom };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mocks.admin),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

vi.mock("@/modules/online-menu/lib/online-public-rate-limit", () => ({
  assertOnlinePublicRateLimit: vi.fn(async () => undefined),
}));

describe("submitPublicOnlineOrder", () => {
  beforeEach(() => {
    mocks.insertedOrders.length = 0;
    mocks.insertedItems.length = 0;
    mocks.admin.from.mockReset();
    mocks.admin.from.mockImplementation(mocks.defaultFrom);
    mocks.admin.rpc.mockReset();
    mocks.admin.rpc.mockResolvedValue({ data: null, error: null });
    process.env.SweetFlow_COOKIE_SECRET = "test-cookie-secret";
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
      fulfillmentType: "pickup",
      lines: [{ productId: "product-1", variantId: "variant-1", quantity: 2 }],
    });

    expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.total).toBe(90);
    expect(result.storeName).toBe("Downtown");
    expect(result.fulfillmentType).toBe("pickup");
    expect(result.deliveryFee).toBe(0);
    expect(result.trackingPath).toMatch(/^\/track\//);
    expect(mocks.insertedOrders[0]).toMatchObject({
      store_id: "store-1",
      customer_name: "Mona",
      customer_phone: "01000000000",
      notes: "No sugar",
      status: "pending",
      subtotal: 90,
      total: 90,
      fulfillment_type: "pickup",
      delivery_fee: 0,
    });
    expect(mocks.insertedItems[0]).toEqual([
      {
        online_order_id: "550e8400-e29b-41d4-a716-446655440000",
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

  it("rejects public orders when ordering is paused", async () => {
    mocks.admin.from.mockImplementation((table: string) => {
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
              timezone: "UTC",
              settings: {
                online_menu_enabled: true,
                online_menu_ordering_enabled: true,
                online_ordering_paused: true,
              },
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { submitPublicOnlineOrder } = await import(
      "@/modules/online-orders/services/online-order.service"
    );

    await expect(
      submitPublicOnlineOrder({
        slug: "downtown",
        customerName: "Mona",
        fulfillmentType: "pickup",
        lines: [{ productId: "product-1", quantity: 1 }],
      })
    ).rejects.toThrow(/متوقف/);
  });

  it("rejects public orders outside enforced hours", async () => {
    mocks.admin.from.mockImplementation((table: string) => {
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
              timezone: "UTC",
              settings: {
                online_menu_enabled: true,
                online_menu_ordering_enabled: true,
                online_ordering_hours: {
                  enforce: true,
                  timezone: "UTC",
                  days: {},
                },
              },
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { submitPublicOnlineOrder } = await import(
      "@/modules/online-orders/services/online-order.service"
    );

    await expect(
      submitPublicOnlineOrder({
        slug: "downtown",
        customerName: "Mona",
        fulfillmentType: "pickup",
        lines: [{ productId: "product-1", quantity: 1 }],
      })
    ).rejects.toThrow(/مغلق|ساعات/);
  });
});
