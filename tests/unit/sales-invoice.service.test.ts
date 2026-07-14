import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertSalesInvoiceAccess,
  correctDeliveredSalesInvoiceCosts,
  deliverSalesInvoice,
  issueSalesInvoice,
  updateDraftSalesInvoiceHeader,
} from "@/modules/sales-invoices/services/sales-invoice.service";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as settingsService from "@/modules/system/services/settings.service";
import * as periodLock from "@/lib/services/period-lock.service";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as auditService from "@/lib/services/audit.service";
import * as orgRepo from "@/lib/repositories/organization.repository";
import {
  DEFAULT_BUSINESS_ACTIVITY_SETTINGS,
  type BusinessActivitySettings,
} from "@/lib/constants";
import type { AppUser, Order, OrderItem } from "@/lib/types";

vi.mock("@/lib/repositories/order.repository");
vi.mock("@/lib/repositories/catalog.repository");
vi.mock("@/lib/repositories/customer.repository");
vi.mock("@/lib/repositories/warehouse.repository");
vi.mock("@/lib/repositories/recipe.repository", () => ({
  getRecipeWithLines: vi.fn().mockResolvedValue(null),
  computeRecipeTotalCost: vi.fn().mockReturnValue(0),
}));
vi.mock("@/lib/repositories/organization.repository");
vi.mock("@/lib/services/audit.service");
vi.mock("@/modules/system/services/settings.service");
vi.mock("@/lib/services/period-lock.service");
vi.mock("@/modules/products/services/pricing-tier.service", () => ({
  listPriceTiers: vi.fn().mockResolvedValue([]),
  resolveUnitPrice: vi.fn().mockReturnValue({
    unitPrice: 10,
    tierId: null,
    wholesaleApplied: true,
  }),
}));

function activity(
  patch: Partial<BusinessActivitySettings>
): BusinessActivitySettings {
  return { ...DEFAULT_BUSINESS_ACTIVITY_SETTINGS, ...patch };
}

const owner: AppUser = {
  id: "u1",
  auth_user_id: "a1",
  org_id: "org1",
  email: "o@x.com",
  name: "Owner",
  role: "owner",
  is_active: true,
  store_ids: [],
};

const cashier: AppUser = {
  ...owner,
  id: "u2",
  role: "cashier",
  email: "c@x.com",
  name: "Cashier",
};

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "ord1",
    store_id: "store1",
    session_id: null,
    order_number: "SI-20260714-0001",
    status: "open",
    customer_id: null,
    subtotal: 100,
    discount: 0,
    tax: 0,
    total: 100,
    payment_status: "unpaid",
    created_by: "u1",
    created_at: new Date().toISOString(),
    sales_mode: "wholesale",
    document_status: "draft",
    document_date: new Date().toISOString().slice(0, 10),
    warehouse_id: "wh1",
    ...overrides,
  };
}

describe("sales invoice access & lifecycle guards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(periodLock.assertPeriodOpen).mockResolvedValue(undefined);
  });

  it("blocks when wholesale sales are disabled", async () => {
    vi.mocked(settingsService.getBusinessActivitySettings).mockResolvedValue(
      activity({
        activity_type: "cafe",
        enable_wholesale_sales: false,
        allow_cashier_wholesale: false,
      })
    );

    await expect(assertSalesInvoiceAccess(owner)).rejects.toThrow(
      "بيع الجملة غير مفعّل"
    );
  });

  it("blocks cashier when allow_cashier_wholesale is false", async () => {
    vi.mocked(settingsService.getBusinessActivitySettings).mockResolvedValue(
      activity({
        activity_type: "mixed",
        enable_wholesale_sales: true,
        allow_cashier_wholesale: false,
      })
    );

    await expect(assertSalesInvoiceAccess(cashier)).rejects.toThrow(
      "الكاشير غير مسموح له ببيع الجملة"
    );
  });

  it("allows cashier when wholesale + cashier wholesale are enabled", async () => {
    vi.mocked(settingsService.getBusinessActivitySettings).mockResolvedValue(
      activity({
        activity_type: "wholesale",
        enable_wholesale_sales: true,
        allow_cashier_wholesale: true,
      })
    );

    await expect(assertSalesInvoiceAccess(cashier)).resolves.toBeUndefined();
  });

  it("refuses editing non-draft invoices", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue(
      order({ document_status: "issued" })
    );

    await expect(
      updateDraftSalesInvoiceHeader({ orderId: "ord1", discount: 5 })
    ).rejects.toThrow("لا يمكن تعديل غير المسودة");
  });

  it("refuses editing invoices bound to a POS session", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue(
      order({ session_id: "sess-1", document_status: "draft" })
    );

    await expect(
      updateDraftSalesInvoiceHeader({ orderId: "ord1", discount: 5 })
    ).rejects.toThrow("مستقلة عن الجلسة");
  });

  it("calls issue RPC for existing orders", async () => {
    const draft = order({ document_date: "2026-07-01" });
    vi.mocked(orderRepo.getOrder).mockResolvedValue(draft);
    vi.mocked(orderRepo.getOrderItems).mockResolvedValue([]);
    vi.mocked(settingsService.getFeatureFlags).mockResolvedValue({
      promotions: false,
    } as never);
    vi.mocked(orderRepo.issueSalesInvoiceRpc).mockResolvedValue({} as never);

    await issueSalesInvoice("ord1");
    expect(orderRepo.issueSalesInvoiceRpc).toHaveBeenCalledWith("ord1");
    expect(periodLock.assertPeriodOpen).toHaveBeenCalledWith(
      "store1",
      "2026-07-01T12:00:00.000Z"
    );
  });

  it("only delivers issued invoices", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue(
      order({ document_status: "draft" })
    );

    await expect(
      deliverSalesInvoice({ orderId: "ord1", paymentMethod: "cash" })
    ).rejects.toThrow("التسليم متاح للفواتير الصادرة فقط");
    expect(orderRepo.deliverSalesInvoiceRpc).not.toHaveBeenCalled();
  });

  it("delivers issued invoices with payment method", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue(
      order({ document_status: "issued", document_date: "2026-06-15" })
    );
    vi.mocked(orderRepo.deliverSalesInvoiceRpc).mockResolvedValue({} as never);

    await deliverSalesInvoice({ orderId: "ord1", paymentMethod: "cash" });
    expect(periodLock.assertPeriodOpen).toHaveBeenCalledWith(
      "store1",
      "2026-06-15T12:00:00.000Z"
    );
    expect(orderRepo.deliverSalesInvoiceRpc).toHaveBeenCalledWith({
      orderId: "ord1",
      paymentMethod: "cash",
    });
  });

  it("delivers credit invoices with deposit + credit remainder payments", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue(
      order({ document_status: "issued", document_date: "2026-06-15", customer_id: "c1" })
    );
    vi.mocked(orderRepo.deliverSalesInvoiceRpc).mockResolvedValue({} as never);

    const payments = [
      { method: "cash" as const, amount: 500 },
      { method: "credit" as const, amount: 1500 },
    ];
    await deliverSalesInvoice({
      orderId: "ord1",
      paymentMethod: "credit",
      payments,
    });
    expect(orderRepo.deliverSalesInvoiceRpc).toHaveBeenCalledWith({
      orderId: "ord1",
      paymentMethod: "credit",
      payments,
    });
  });

  it("rejects credit deliver without customer", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue(
      order({ document_status: "issued", customer_id: null })
    );

    await expect(
      deliverSalesInvoice({
        orderId: "ord1",
        paymentMethod: "credit",
        payments: [
          { method: "cash", amount: 100 },
          { method: "credit", amount: 100 },
        ],
      })
    ).rejects.toThrow("اختر عميلًا لتسليم فاتورة آجل");
    expect(orderRepo.deliverSalesInvoiceRpc).not.toHaveBeenCalled();
  });

  it("rejects invalid warehouse on header update", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue(order());
    vi.mocked(warehouseRepo.listWarehouses).mockResolvedValue([
      {
        id: "wh-other",
        org_id: "org1",
        store_id: "store1",
        name: "Other",
        is_active: true,
        is_default: false,
        created_at: "",
      },
    ]);

    await expect(
      updateDraftSalesInvoiceHeader({
        orderId: "ord1",
        warehouseId: "wh1",
      })
    ).rejects.toThrow("المخزن غير صالح");
  });
});

describe("correctDeliveredSalesInvoiceCosts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(periodLock.assertPeriodOpen).mockResolvedValue(undefined);
    vi.mocked(settingsService.getFeatureFlags).mockResolvedValue({
      recipes: false,
    } as never);
    vi.mocked(orgRepo.getOrgId).mockResolvedValue("org1");
    vi.mocked(auditService.writeAuditLog).mockResolvedValue({} as never);
  });

  it("rejects cashier", async () => {
    await expect(
      correctDeliveredSalesInvoiceCosts("ord1", cashier)
    ).rejects.toThrow("للمالك والمدير فقط");
  });

  it("rejects non-delivered invoices", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue(
      order({ document_status: "issued" })
    );
    await expect(
      correctDeliveredSalesInvoiceCosts("ord1", owner)
    ).rejects.toThrow("للفواتير المُسلَّمة فقط");
  });

  it("updates zero-cost lines from current last_unit_cost", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue(
      order({ document_status: "delivered", document_date: "2026-07-01" })
    );
    const line: OrderItem = {
      id: "line1",
      order_id: "ord1",
      product_id: "p1",
      variant_id: null,
      quantity: 0.25,
      unit_price: 80,
      modifiers: [],
      line_total: 20,
      unit_cost: 0,
      line_cost: 0,
      sale_unit: "kg",
      base_quantity: 0.25,
      sale_input_mode: null,
      tier_id: null,
      wholesale_applied: true,
      line_note: null,
    };
    vi.mocked(orderRepo.getOrderItems).mockResolvedValue([line]);
    vi.mocked(catalogRepo.getProductsByIds).mockResolvedValue(
      new Map([
        [
          "p1",
          {
            id: "p1",
            last_unit_cost: 40,
          } as never,
        ],
      ])
    );
    vi.mocked(orderRepo.updateDeliveredOrderItemCosts).mockResolvedValue();

    const result = await correctDeliveredSalesInvoiceCosts("ord1", owner);

    expect(result.changedLines).toBe(1);
    expect(result.previousTotal).toBe(0);
    expect(result.nextTotal).toBe(10);
    expect(orderRepo.updateDeliveredOrderItemCosts).toHaveBeenCalledWith(
      "ord1",
      [{ lineId: "line1", unitCost: 40, lineCost: 10 }]
    );
    expect(auditService.writeAuditLog).toHaveBeenCalled();
  });

  it("skips write when costs already match", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue(
      order({ document_status: "delivered" })
    );
    vi.mocked(orderRepo.getOrderItems).mockResolvedValue([
      {
        id: "line1",
        order_id: "ord1",
        product_id: "p1",
        variant_id: null,
        quantity: 1,
        unit_price: 50,
        modifiers: [],
        line_total: 50,
        unit_cost: 20,
        line_cost: 20,
        sale_unit: null,
        base_quantity: 1,
        sale_input_mode: null,
        tier_id: null,
        wholesale_applied: true,
        line_note: null,
      },
    ]);
    vi.mocked(catalogRepo.getProductsByIds).mockResolvedValue(
      new Map([["p1", { id: "p1", last_unit_cost: 20 } as never]])
    );

    const result = await correctDeliveredSalesInvoiceCosts("ord1", owner);
    expect(result.changedLines).toBe(0);
    expect(orderRepo.updateDeliveredOrderItemCosts).not.toHaveBeenCalled();
    expect(auditService.writeAuditLog).not.toHaveBeenCalled();
  });
});
