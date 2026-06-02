import * as orderRepo from "@/lib/repositories/order.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { earnPoints } from "@/modules/loyalty/services/loyalty.service";
import {
  getSessionSettings,
  isFeatureEnabled,
} from "@/modules/system/services/settings.service";
import { computeSessionLifecycle } from "@/modules/sessions/services/session-lifecycle.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import type { CartLine, Customer, Order, PaymentMethod, PaymentSplit } from "@/lib/types";

export interface CheckoutInput {
  storeId: string;
  sessionId: string | null;
  cashierId: string;
  deviceId?: string;
  cart: CartLine[];
  customer: Customer | null;
  paymentMethod: PaymentMethod;
  payments?: PaymentSplit[];
  discount?: number;
  override?: {
    expiredSession?: boolean;
  };
}

export interface CheckoutResult {
  order: Order;
  orderNumber: string;
}

export async function completeCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  if (!input.sessionId) {
    throw new Error("Active cashier session required");
  }

  await assertPeriodOpen(input.storeId);

  const session = await sessionRepo.getSession(input.sessionId);
  if (!session || session.status !== "open" || session.store_id !== input.storeId) {
    throw new Error("Invalid or closed cashier session");
  }
  if (input.deviceId && session.device_id && session.device_id !== input.deviceId) {
    throw new Error("Session does not match this device");
  }

  const settings = await getSessionSettings();
  const lifecycle = computeSessionLifecycle(session, settings);
  if (lifecycle.blocksSales && !input.override?.expiredSession) {
    throw new Error("Session expired — close shift to continue");
  }

  const lines = input.cart.map((line) => ({
    product_id: line.productId,
    variant_id: line.variantId,
    quantity: line.quantity,
  }));

  for (const line of input.cart) {
    const variants = await catalogRepo.listVariants(line.productId);
    const activeVariants = variants.filter((v) => v.is_active);
    if (activeVariants.length > 0 && !line.variantId) {
      throw new Error(`Variant required for ${line.name}`);
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
    discount: input.discount ?? 0,
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
  if (!order) throw new Error("Order not found after checkout");

  if (input.customer?.id && (await isFeatureEnabled("loyalty"))) {
    await earnPoints({
      customerId: input.customer.id,
      orderId: order.id,
      orderTotal: order.total,
    });
  }

  return { order, orderNumber: result.order_number };
}
