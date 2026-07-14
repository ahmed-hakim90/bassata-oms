import * as orderRepo from "@/lib/repositories/order.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import { roundMoney } from "@/lib/money";
import {
  earnPoints,
  getCustomerLoyaltyBalance,
  getLoyaltyRule,
  redeemPoints,
} from "@/modules/loyalty/services/loyalty.service";
import { computePosCartTotals, rawCartSubtotal } from "@/modules/pos/lib/cart-totals";
import { evaluateCartPromotions } from "@/modules/promotions/services/promotion.service";
import { getSessionSettings, isFeatureEnabled } from "@/modules/system/services/settings.service";
import { computeSessionLifecycle } from "@/modules/sessions/services/session-lifecycle.service";
import type { CartLine, CashierSession, Customer, Order, PaymentMethod, PaymentSplit } from "@/lib/types";
import type { SalesMode } from "@/lib/constants";
import { after } from "next/server";

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
  couponCode?: string | null;
  loyaltyPoints?: number;
  override?: {
    expiredSession?: boolean;
  };
  /** When the action already loaded the open session, skip a second fetch. */
  session?: CashierSession;
  /**
   * Caller already verified open session + lifecycle (or expired override).
   * Skips a second settings/lifecycle pass on the checkout hot path.
   */
  sessionGateChecked?: boolean;
}

export interface CheckoutResult {
  order: Order;
  orderNumber: string;
}

export async function completeCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  if (!input.sessionId) {
    throw new Error("جلسة كاشير نشطة مطلوبة");
  }

  // Catalog/stock/variant/device checks live in complete_checkout RPC — avoid
  // duplicate pre-RPC round-trips that dominate cashier save latency.
  let session = input.session && input.session.id === input.sessionId ? input.session : null;
  if (!input.sessionGateChecked || !session) {
    const [loadedSession, settings] = await Promise.all([
      session ?? sessionRepo.getSession(input.sessionId),
      getSessionSettings(),
    ]);
    session = loadedSession;
    if (!session || session.status !== "open" || session.store_id !== input.storeId) {
      throw new Error("جلسة الكاشير غير صالحة أو مغلقة");
    }
    const lifecycle = computeSessionLifecycle(session, settings);
    if (lifecycle.blocksSales && !input.override?.expiredSession) {
      throw new Error("انتهت الجلسة - أغلق الوردية للمتابعة");
    }
  } else if (session.status !== "open" || session.store_id !== input.storeId) {
    throw new Error("جلسة الكاشير غير صالحة أو مغلقة");
  }

  if (input.cart.length === 0) {
    throw new Error("السلة فارغة");
  }

  const listSubtotal = rawCartSubtotal(input.cart);
  const orderDiscount = roundMoney(input.discount ?? 0);
  if (orderDiscount < 0) {
    throw new Error("قيمة الخصم غير صالحة");
  }
  if (orderDiscount > listSubtotal + 0.01) {
    throw new Error("قيمة الخصم أكبر من إجمالي الفاتورة");
  }

  const promotionsEnabled = await isFeatureEnabled("promotions");
  const promoPreview = promotionsEnabled
    ? await evaluateCartPromotions({
        lines: input.cart.map((line, index) => ({
          line_key: line.id || String(index),
          product_id: line.productId,
          category_id: line.categoryId ?? null,
          quantity: line.quantity,
          unit_price: line.unitPrice,
        })),
        storeId: input.storeId,
        saleMode: input.salesMode ?? "retail",
        couponCode: input.couponCode,
      })
    : null;

  const lines = input.cart.map((line) => ({
    product_id: line.productId,
    variant_id: line.variantId,
    quantity: line.quantity,
    sale_input_mode: line.saleInputMode,
    entered_amount: line.enteredAmount,
    tier_id: line.tierId ?? null,
  }));

  const requestedPoints = Math.floor(input.loyaltyPoints ?? 0);
  let loyaltyDiscount = 0;
  let loyaltyRule = null;

  // Preview totals without loyalty first so redemption cap matches UI.
  const totalsBeforeLoyalty = computePosCartTotals({
    cart: input.cart,
    discountAmount: orderDiscount,
    promoPreview,
  });

  // Only block the sale for redemption validation. Earn runs after response.
  if (requestedPoints > 0) {
    if (!input.customer?.id) {
      throw new Error("اختر عميلاً لاستبدال نقاط الولاء");
    }
    loyaltyRule = await getLoyaltyRule();
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
    loyaltyDiscount = roundMoney(requestedPoints * loyaltyRule.redemption_rate);
    const maxDiscount = totalsBeforeLoyalty.payableBeforeLoyalty;
    if (loyaltyDiscount > maxDiscount + 0.01) {
      throw new Error("قيمة النقاط المستبدلة أكبر من إجمالي الفاتورة");
    }
  }

  const expectedTotal = computePosCartTotals({
    cart: input.cart,
    discountAmount: orderDiscount,
    loyaltyAmount: loyaltyDiscount,
    promoPreview,
  }).payableTotal;
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
    couponCode: input.couponCode?.trim() ? input.couponCode.trim() : null,
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
    if (message.includes("Variant required")) {
      throw new Error("الخيار مطلوب لأحد المنتجات في السلة");
    }
    if (message.includes("Insufficient stock")) {
      throw new Error(
        "المخزون غير كافٍ — البيع متوقف لأن إعداد «منع المخزون السالب» مفعّل. راجع الرصيد أو عطّل الإعداد من خصائص النظام."
      );
    }
    if (message.includes("Insufficient batch stock")) {
      throw new Error(
        "رصيد التشغيلة غير كافٍ — البيع متوقف بسبب منع المخزون السالب. راجع التشغيلات أو عطّل الإعداد."
      );
    }
    throw error;
  }

  const usesCredit = payments.some((payment) => payment.method === "credit");
  const rpcPaymentStatus =
    "payment_status" in result &&
    (result.payment_status === "paid" ||
      result.payment_status === "unpaid" ||
      result.payment_status === "partial")
      ? result.payment_status
      : null;
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
    payment_status:
      rpcPaymentStatus ??
      (usesCredit ? (payments.length === 1 ? "unpaid" : "partial") : "paid"),
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

  // Earn after the cashier gets success — do not block invoice/toast.
  if (input.customer?.id) {
    const customerId = input.customer.id;
    const orderId = order.id;
    const orderTotal = order.total;
    after(() => {
      void (async () => {
        try {
          if (!(await isFeatureEnabled("loyalty"))) return;
          await earnPoints({
            customerId,
            orderId,
            orderTotal,
          });
        } catch (error) {
          console.error("[checkout] deferred loyalty earn failed", error);
        }
      })();
    });
  }

  return { order, orderNumber: result.order_number };
}
