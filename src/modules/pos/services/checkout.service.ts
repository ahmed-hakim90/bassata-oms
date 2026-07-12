import * as orderRepo from "@/lib/repositories/order.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as deviceRepo from "@/lib/repositories/device.repository";
import {
  earnPoints,
  getCustomerLoyaltyBalance,
  getLoyaltyRule,
  redeemPoints,
} from "@/modules/loyalty/services/loyalty.service";
import {
  getInventoryPolicySettings,
  getSessionSettings,
  isFeatureEnabled,
} from "@/modules/system/services/settings.service";
import { computeSessionLifecycle } from "@/modules/sessions/services/session-lifecycle.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import type { CartLine, Customer, Order, PaymentMethod, PaymentSplit } from "@/lib/types";
import type { SalesMode } from "@/lib/constants";

export interface CheckoutInput {
  storeId: string;
  sessionId: string | null;
  cashierId: string;
  deviceId?: string;
  cart: CartLine[];
  customer: Customer | null;
  paymentMethod: PaymentMethod;
  payments?: PaymentSplit[];
  salesMode?: SalesMode;
  discount?: number;
  loyaltyPoints?: number;
  override?: {
    expiredSession?: boolean;
  };
}

export interface CheckoutResult {
  order: Order;
  orderNumber: string;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getCartSubtotal(cart: CartLine[]): number {
  return roundMoney(cart.reduce((sum, line) => sum + line.lineTotal, 0));
}

export async function completeCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  if (!input.sessionId) {
    throw new Error("جلسة كاشير نشطة مطلوبة");
  }

  await assertPeriodOpen(input.storeId);

  const session = await sessionRepo.getSession(input.sessionId);
  if (!session || session.status !== "open" || session.store_id !== input.storeId) {
    throw new Error("جلسة الكاشير غير صالحة أو مغلقة");
  }
  // Same open session may continue on any paired device for this store
  // (phone + register). Still require an active device registered to the store.
  if (input.deviceId) {
    const device = await deviceRepo.getDevice(input.deviceId);
    if (!device || !device.is_active || device.store_id !== session.store_id) {
      throw new Error("الجهاز غير صالح لهذا الفرع");
    }
  }

  const settings = await getSessionSettings();
  const lifecycle = computeSessionLifecycle(session, settings);
  if (lifecycle.blocksSales && !input.override?.expiredSession) {
    throw new Error("انتهت الجلسة - أغلق الوردية للمتابعة");
  }

  if (input.cart.length === 0) {
    throw new Error("السلة فارغة");
  }

  const subtotal = getCartSubtotal(input.cart);
  const orderDiscount = roundMoney(input.discount ?? 0);
  if (orderDiscount < 0) {
    throw new Error("قيمة الخصم غير صالحة");
  }
  if (orderDiscount > subtotal + 0.01) {
    throw new Error("قيمة الخصم أكبر من إجمالي الفاتورة");
  }

  const lines = input.cart.map((line) => ({
    product_id: line.productId,
    variant_id: line.variantId,
    quantity: line.quantity,
    sale_input_mode: line.saleInputMode,
    entered_amount: line.enteredAmount,
    tier_id: line.tierId ?? null,
  }));

  const productIds = [...new Set(input.cart.map((line) => line.productId))];
  const [variantMap, productMap, inventoryPolicy, preventNegativeStock, warehouse, loyaltyEnabled] =
    await Promise.all([
      catalogRepo.listVariantsForProducts(productIds),
      catalogRepo.getProductsByIds(productIds),
      getInventoryPolicySettings(),
      isFeatureEnabled("prevent_negative_stock"),
      warehouseRepo.getDefaultWarehouse(input.storeId),
      isFeatureEnabled("loyalty"),
    ]);

  for (const line of input.cart) {
    const activeVariants = (variantMap.get(line.productId) ?? []).filter((v) => v.is_active);
    if (activeVariants.length > 0 && !line.variantId) {
      throw new Error(`الخيار مطلوب للمنتج ${line.name}`);
    }
  }

  const warehouseId = warehouse?.id ?? null;
  const batchTrackedProductIds = [...productMap.values()]
    .filter((product) => product.inventory_tracking_mode === "batch_and_expiry")
    .map((product) => product.id)
    .filter((id) => productIds.includes(id));

  const allBatches =
    warehouseId && batchTrackedProductIds.length > 0
      ? await inventoryRepo.listInventoryBatchesForProducts(
          input.storeId,
          warehouseId,
          batchTrackedProductIds
        )
      : [];
  const today = new Date();
  const nearExpiryThreshold = Number(
    Array.isArray(inventoryPolicy.alert_days) ? inventoryPolicy.alert_days[0] : 7
  );
  const nearExpiryDate = new Date();
  nearExpiryDate.setDate(today.getDate() + nearExpiryThreshold);

  for (const line of input.cart) {
    const product = productMap.get(line.productId);
    if (!product || product.inventory_tracking_mode !== "batch_and_expiry") continue;

    const productBatches = allBatches
      .filter(
        (batch) =>
          batch.product_id === line.productId &&
          (batch.variant_id ?? null) === (line.variantId ?? null)
      )
      .filter((batch) => batch.remaining_quantity > 0);
    if (productBatches.length === 0) continue;

    const expired = productBatches.some(
      (batch) => batch.expiry_date && new Date(batch.expiry_date) < today
    );
    if (preventNegativeStock && expired && (product.expiry_policy ?? "block_sale") === "block_sale") {
      throw new Error(`مخزون ${line.name} منتهي الصلاحية وممنوع بيعه حسب السياسة`);
    }

    const nearExpiry = productBatches.some(
      (batch) =>
        batch.expiry_date &&
        new Date(batch.expiry_date) >= today &&
        new Date(batch.expiry_date) <= nearExpiryDate
    );
    if (nearExpiry && (product.expiry_policy ?? "block_sale") === "warn_only") {
      // Do not block; message is consumed by UI toast/alert when surfaced.
      console.warn(`[expiry-warning] ${line.name} has near-expiry stock`);
    }
  }

  // Loyalty redemption: validate before the order exists, deduct points after.
  const requestedPoints = Math.floor(input.loyaltyPoints ?? 0);
  let loyaltyDiscount = 0;
  const loyaltyRule =
    requestedPoints > 0 || loyaltyEnabled ? await getLoyaltyRule() : null;
  if (requestedPoints > 0) {
    if (!input.customer?.id) {
      throw new Error("اختر عميلاً لاستبدال نقاط الولاء");
    }
    if (!loyaltyRule?.is_active || loyaltyRule.redemption_rate <= 0) {
      throw new Error("برنامج الولاء غير مفعل");
    }
    if (requestedPoints < loyaltyRule.minimum_redeem_points) {
      throw new Error(`الحد الأدنى لاستبدال النقاط هو ${loyaltyRule.minimum_redeem_points} نقطة`);
    }
    const balance = await getCustomerLoyaltyBalance(input.customer.id);
    if (requestedPoints > balance) {
      throw new Error("رصيد نقاط العميل غير كافٍ");
    }
    loyaltyDiscount = Math.round(requestedPoints * loyaltyRule.redemption_rate * 100) / 100;
    const maxDiscount = Math.max(0, subtotal - orderDiscount);
    if (loyaltyDiscount > maxDiscount + 0.01) {
      throw new Error("قيمة النقاط المستبدلة أكبر من إجمالي الفاتورة");
    }
  }

  const expectedTotal = roundMoney(Math.max(0, subtotal - orderDiscount - loyaltyDiscount));
  let payments =
    input.payments
      ?.map((payment) => ({
        method: payment.method,
        amount: roundMoney(Number(payment.amount) || 0),
      }))
      .filter((payment) => payment.amount > 0) ?? [];
  if (payments.length > 1) {
    const sum = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
    const diff = roundMoney(expectedTotal - sum);
    if (Math.abs(diff) >= 0.01) {
      const last = payments[payments.length - 1]!;
      last.amount = roundMoney(last.amount + diff);
      payments = payments.filter((payment) => payment.amount > 0);
    }
  }
  const checkoutPayload = {
    storeId: input.storeId,
    sessionId: input.sessionId,
    cashierId: input.cashierId,
    deviceId: input.deviceId ?? null,
    customerId: input.customer?.id ?? null,
    paymentMethod: payments[0]?.method ?? input.paymentMethod,
    salesMode: input.salesMode ?? "retail",
    discount: roundMoney(orderDiscount + loyaltyDiscount),
    lines,
  };
  let result;
  try {
    result = input.override?.expiredSession
      ? payments.length > 1
        ? await orderRepo.completeCheckoutSplitExpiredOverrideRpc({ ...checkoutPayload, payments })
        : await orderRepo.completeCheckoutExpiredOverrideRpc(checkoutPayload)
      : payments.length > 1
        ? await orderRepo.completeCheckoutSplitRpc({ ...checkoutPayload, payments })
        : await orderRepo.completeCheckoutRpc(checkoutPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Split payments must equal order total")) {
      throw new Error("مبالغ الدفع المقسّم لا تطابق إجمالي الفاتورة");
    }
    if (message.includes("Credit cannot be mixed with split payments")) {
      throw new Error("لا يمكن خلط البيع الآجل مع الدفع المقسّم");
    }
    if (message.includes("Only one credit payment line is allowed")) {
      throw new Error("سطر آجل واحد فقط في الفاتورة");
    }
    if (message.includes("Credit limit exceeded")) {
      throw new Error("تم تجاوز حد الائتمان للعميل");
    }
    if (message.includes("Customer required for credit sale")) {
      throw new Error("اختر عميلًا للبيع الآجل");
    }
    if (message.includes("Payment amount must be greater than zero")) {
      throw new Error("مبلغ الدفع يجب أن يكون أكبر من صفر");
    }
    throw error;
  }

  // RPC already returns the fields callers need — avoid a post-checkout getOrder round-trip.
  const usesCredit = payments.some((payment) => payment.method === "credit");
  const order: Order = {
    id: result.order_id,
    store_id: input.storeId,
    session_id: input.sessionId,
    order_number: result.order_number,
    customer_id: input.customer?.id ?? null,
    status: "completed",
    subtotal: result.subtotal,
    discount: roundMoney(orderDiscount + loyaltyDiscount),
    tax: result.tax,
    total: result.total,
    payment_status: usesCredit
      ? payments.length === 1
        ? "unpaid"
        : "partial"
      : "paid",
    created_by: input.cashierId,
    created_at: new Date().toISOString(),
    sales_mode: input.salesMode ?? "retail",
  };

  if (input.customer?.id && requestedPoints > 0) {
    await redeemPoints({
      customerId: input.customer.id,
      points: requestedPoints,
      reason: `استبدال نقاط - طلب ${result.order_number}`,
      userId: input.cashierId,
      storeId: input.storeId,
      rule: loyaltyRule,
    });
  }

  if (input.customer?.id && loyaltyEnabled && loyaltyRule?.is_active) {
    await earnPoints({
      customerId: input.customer.id,
      orderId: order.id,
      orderTotal: order.total,
      rule: loyaltyRule,
    });
  }

  return { order, orderNumber: result.order_number };
}
