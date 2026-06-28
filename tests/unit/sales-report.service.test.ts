import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSalesReport } from "@/modules/reports/services/sales-report.service";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { getDb } from "@/lib/repositories/client";

vi.mock("@/lib/repositories/order.repository");
vi.mock("@/lib/repositories/catalog.repository");
vi.mock("@/lib/repositories/store.repository");
vi.mock("@/lib/repositories/client", () => ({
  getDb: vi.fn(),
}));

describe("getSalesReport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(storeRepo.listStores).mockResolvedValue([
      {
        id: "store-1",
        org_id: "org-1",
        name: "Main",
        code: "MAIN",
        address: "",
        phone: "",
        timezone: "UTC",
        is_active: true,
        settings: {},
      },
    ]);
    vi.mocked(catalogRepo.listProducts).mockResolvedValue([
      {
        id: "p1",
        org_id: "org-1",
        name: "Latte",
        sku: "LATTE",
        barcode: "",
        category_id: "cat-1",
        base_price: 100,
        description: "",
        sale_price: null,
        image_url: null,
        is_active: true,
        is_popular: false,
        track_inventory: true,
        product_type: "finished",
        unit: "piece",
        last_unit_cost: 40,
        cost_unit: "piece",
        updated_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(catalogRepo.listVariants).mockResolvedValue([]);
    vi.mocked(getDb).mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            {
              order_id: "o1",
              product_id: "p1",
              variant_id: null,
              quantity: 1,
              line_total: 100,
              line_cost: 40,
              sale_unit: "piece",
              base_quantity: 1,
            },
          ],
        }),
      })),
    } as never);
  });

  it("allocates order-level discounts to product revenue", async () => {
    vi.mocked(orderRepo.listOrders).mockResolvedValue([
      {
        id: "o1",
        store_id: "store-1",
        session_id: "s1",
        order_number: "SF-1",
        customer_id: null,
        status: "completed",
        subtotal: 100,
        discount: 20,
        tax: 0,
        total: 80,
        payment_status: "paid",
        created_by: "u1",
        created_at: new Date().toISOString(),
      },
    ]);

    const report = await getSalesReport({ days: 1 });

    expect(report.totalRevenue).toBe(80);
    expect(report.topProducts[0]).toMatchObject({
      name: "Latte",
      revenue: 80,
      cost: 40,
      profit: 40,
    });
  });
});
