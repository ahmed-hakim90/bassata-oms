import * as orderRepo from "@/lib/repositories/order.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
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
  if (input.deviceId && session.device_id && session.device_id !== input.deviceId) {
    throw new Error("الجلسة لا تتطابق مع هذا الجهاز");
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

  for (const line of input.cart) {
    const variants = await catalogRepo.listVariants(line.productId);
    const activeVariants = variants.filter((v) => v.is_active);
    if (activeVariants.length > 0 && !line.variantId) {
      throw new Error(`الخيار مطلوب للمنتج ${line.name}`);
    }
  }

  const inventoryPolicy = await getInventoryPolicySettings();
  const warehouse = await warehouseRepo.getDefaultWarehouse(input.storeId);
  const warehouseId = warehouse?.id ?? null;
  const allBatches = warehouseId ? await inventoryRepo.listInventoryBatches(input.storeId, warehouseId) : [];
  const today = new Date();
  const nearExpiryThreshold = Number(
    Array.isArray(inventoryPolicy.alert_days) ? inventoryPolicy.alert_days[0] : 7
  );
  const nearExpiryDate = new Date();
  nearExpiryDate.setDate(today.getDate() + nearExpiryThreshold);

  for (const line of input.cart) {
    const product = await catalogRepo.getProduct(line.productId);
    if (!product || product.inventory_tracking_mode !== "batch_and_expiry") continue;

    const productBatches = allBatches
      .filter((batch) => batch.product_id === line.productId && (batch.variant_id ?? null) === (line.variantId ?? null))
      .filter((batch) => batch.remaining_quantity > 0);
    if (productBatches.length === 0) continue;

    const expired = productBatches.some((batch) => batch.expiry_date && new Date(batch.expiry_date) < today);
    if (expired && (product.expiry_policy ?? "block_sale") === "block_sale") {
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
  if (requestedPoints > 0) {
    if (!input.customer?.id) {
      throw new Error("اختر عميلاً لاستبدال نقاط الولاء");
    }
    const rule = await getLoyaltyRule();
    if (!rule?.is_active || rule.redemption_rate <= 0) {
      throw new Error("برنامج الولاء غير مفعل");
    }
    if (requestedPoints < rule.minimum_redeem_points) {
      throw new Error(`الحد الأدنى لاستبدال النقاط هو ${rule.minimum_redeem_points} نقطة`);
    }
    const balance = await getCustomerLoyaltyBalance(input.customer.id);
    if (requestedPoints > balance) {
      throw new Error("رصيد نقاط العميل غير كافٍ");
    }
    loyaltyDiscount = Math.round(requestedPoints * rule.redemption_rate * 100) / 100;
    const maxDiscount = Math.max(0, subtotal - orderDiscount);
    if (loyaltyDiscount > maxDiscount + 0.01) {
      throw new Error("قيمة النقاط المستبدلة أكبر من إجمالي الفاتورة");
    }
  }

  const payments = input.payments?.filter((payment) => payment.amount > 0) ?? [];
  const checkoutPayload = {
    storeId: input.storeId,
    sessionId: input.sessionId,
    cashierId: input.cashierId,
    deviceId: input.deviceId ?? null,
    customerId: input.customer?.id ?? null,
    paymentMethod: input.paymentMethod,
    salesMode: input.salesMode ?? "retail",
    discount: roundMoney(orderDiscount + loyaltyDiscount),
    lines,
  };
  const result = input.override?.expiredSession
    ? payments.length > 1
      ? await orderRepo.completeCheckoutSplitExpiredOverrideRpc({ ...checkoutPayload, payments })
      : await orderRepo.completeCheckoutExpiredOverrideRpc(checkoutPayload)
    : payments.length > 1
      ? await orderRepo.completeCheckoutSplitRpc({ ...checkoutPayload, payments })
      : await orderRepo.completeCheckoutRpc(checkoutPayload);

  const order = await orderRepo.getOrder(result.order_id);
  if (!order) throw new Error("لم يتم العثور على الطلب بعد إتمام البيع");

  if (input.customer?.id && requestedPoints > 0) {
    await redeemPoints({
      customerId: input.customer.id,
      points: requestedPoints,
      reason: `استبدال نقاط - طلب ${result.order_number}`,
      userId: input.cashierId,
      storeId: input.storeId,
    });
  }

  if (input.customer?.id && (await isFeatureEnabled("loyalty"))) {
    await earnPoints({
      customerId: input.customer.id,
      orderId: order.id,
      orderTotal: order.total,
    });
  }

  return { order, orderNumber: result.order_number };
}
