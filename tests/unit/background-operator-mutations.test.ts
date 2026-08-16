import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePosStore } from "@/stores/pos-store";
import { useBackgroundMutationStore } from "@/stores/background-mutation-store";

const receivePurchaseSql = readFileSync(
  "supabase/migrations/20260816192751_receive_purchase_invoice.sql",
  "utf8"
);

describe("atomic purchase receive", () => {
  it("locks the invoice and posts stock inside one RPC", () => {
    expect(receivePurchaseSql).toContain("receive_purchase_invoice");
    expect(receivePurchaseSql).toContain("FOR UPDATE");
    expect(receivePurchaseSql).toContain("Already received");
    expect(receivePurchaseSql).toContain("adjust_inventory_stock");
    expect(receivePurchaseSql).toContain("landed_unit_cost");
    expect(receivePurchaseSql).toContain("supplier_payments");
    expect(receivePurchaseSql).toContain("purchase.received");
    expect(receivePurchaseSql).toContain("FROM PUBLIC, anon");
  });
});

vi.mock("@/lib/repositories/purchase.repository", () => ({
  receivePurchaseAtomic: vi.fn(),
}));

vi.mock("@/modules/system/services/settings.service", () => ({
  isFeatureEnabled: vi.fn(async () => false),
}));

vi.mock("next/server", () => ({
  after: (fn: () => void) => {
    fn();
  },
}));

describe("receivePurchase service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls the atomic RPC once instead of per-line adjustStock", async () => {
    const purchaseRepo = await import("@/lib/repositories/purchase.repository");
    vi.mocked(purchaseRepo.receivePurchaseAtomic).mockResolvedValue({
      id: "inv-1",
      store_id: "store-1",
      warehouse_id: "wh-1",
      supplier_id: "sup-1",
      invoice_number: "PI-1",
      status: "received",
      subtotal: 100,
      extra_cost: 0,
      tax: 0,
      total: 100,
      document_date: "2026-08-16",
      received_at: "2026-08-16T12:00:00.000Z",
      cancelled_at: null,
      created_by: "user-1",
      created_at: "2026-08-16T10:00:00.000Z",
      amount_paid: 0,
      payment_method: null,
      line_count: 3,
    });

    const { receivePurchase } = await import(
      "@/modules/purchases/services/purchase.service"
    );
    const result = await receivePurchase("inv-1", "user-1", { amountPaid: 0 });

    expect(purchaseRepo.receivePurchaseAtomic).toHaveBeenCalledTimes(1);
    expect(purchaseRepo.receivePurchaseAtomic).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      userId: "user-1",
      amountPaid: 0,
      paymentMethod: undefined,
      preventNegativeStock: false,
    });
    expect(result).toMatchObject({
      id: "inv-1",
      invoice_number: "PI-1",
      status: "received",
      total: 100,
      amountPaid: 0,
    });
  });
});

describe("POS failed checkout restore", () => {
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
    });
    useBackgroundMutationStore.setState({ mutations: {} });
  });

  it("keeps the current cart and restores a failed checkout hold separately", () => {
    usePosStore.getState().addItem({
      productId: "p-new",
      variantId: null,
      name: "عميل جديد",
      quantity: 1,
      unitPrice: 20,
      modifiers: [],
      imageUrl: null,
    });

    const failedHold = {
      id: `temp-hold-${crypto.randomUUID()}`,
      name: "فاتورة فشلت — اضغط للاستعادة",
      cart: [
        {
          id: "line-old",
          productId: "p-old",
          variantId: null,
          name: "قديمة",
          quantity: 2,
          unitPrice: 10,
          modifiers: [],
          lineTotal: 20,
          imageUrl: null,
        },
      ],
      customer: null,
      discountAmount: 0,
      couponCode: "",
      salesMode: "retail" as const,
      createdAt: new Date().toISOString(),
      failedCheckout: true,
      failureMessage: "رصيد غير كافٍ",
    };

    usePosStore.getState().parkFailedCheckoutHold(failedHold);

    const state = usePosStore.getState();
    expect(state.cart).toHaveLength(1);
    expect(state.cart[0]?.name).toBe("عميل جديد");
    expect(state.heldCarts).toHaveLength(1);
    expect(state.heldCarts[0]?.failedCheckout).toBe(true);

    expect(state.resumeHeldCart(failedHold.id)).toBe(true);
    const restored = usePosStore.getState();
    expect(restored.cart).toHaveLength(1);
    expect(restored.cart[0]?.name).toBe("قديمة");
    expect(restored.heldCarts).toHaveLength(0);
  });

  it("rejects a second pending background mutation with the same key", () => {
    const store = useBackgroundMutationStore.getState();
    expect(store.start("pos:checkout:s1", "جاري حفظ البيع…")).toBe(true);
    expect(store.start("pos:checkout:s1", "جاري حفظ البيع…")).toBe(false);
    expect(store.isPending("pos:checkout:s1")).toBe(true);
    store.succeed("pos:checkout:s1");
    expect(store.isPending("pos:checkout:s1")).toBe(false);
  });
});
