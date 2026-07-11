"use server";

import { revalidatePath } from "next/cache";
import { requireFeatures, requirePermissionOrRole } from "@/lib/auth/guards";
import { requirePosAccess, getActiveSessionForPos } from "@/lib/auth/pos-access";
import { completeCheckout } from "@/modules/pos/services/checkout.service";
import { computeSessionLifecycle } from "@/modules/sessions/services/session-lifecycle.service";
import { getSessionSettings } from "@/modules/system/services/settings.service";
import type { CartLine, Customer, PaymentMethod, PaymentSplit } from "@/lib/types";
import type { FeatureFlag, SalesMode } from "@/lib/constants";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { requiresManagerDiscountOverride } from "@/modules/pos/services/manager-override.service";

type CheckoutOverride = {
  discount?: boolean;
  expiredSession?: boolean;
  reason?: string;
};

export async function checkoutAction(input: {
  cart: CartLine[];
  customer: Customer | null;
  paymentMethod: PaymentMethod;
  payments?: PaymentSplit[];
  salesMode?: SalesMode;
  discount?: number;
  loyaltyPoints?: number;
  override?: CheckoutOverride;
}) {
  const user = await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  const ctx = await requirePosAccess();
  const payments = (input.payments?.length
    ? input.payments
    : [{ method: input.paymentMethod, amount: 0 }]
  ).filter((payment) => payment.amount > 0);
  if (!payments.length) {
    throw new Error("أدخل مبلغ دفع صالحاً");
  }
  const paymentMethod = payments[0]?.method ?? input.paymentMethod;
  const usesCredit = payments.some((payment) => payment.method === "credit");

  const featureChecks: FeatureFlag[] = ["inventory_deduction"];
  for (const payment of payments) {
    featureChecks.push(
      payment.method === "credit"
        ? "credit_sales"
        : (`payment_${payment.method}` as FeatureFlag)
    );
  }
  if ((input.discount ?? 0) > 0) featureChecks.push("customer_discounts");
  if ((input.loyaltyPoints ?? 0) > 0) featureChecks.push("loyalty");
  await requireFeatures([...new Set(featureChecks)]);

  if (usesCredit) {
    await requirePermissionOrRole("customer_credit_sale", ["owner", "manager", "cashier"]);
    if (!input.customer) {
      throw new Error("اختر عميلًا للبيع الآجل");
    }
  }
  if ((input.loyaltyPoints ?? 0) > 0 && !input.customer) {
    throw new Error("اختر عميلاً لاستبدال نقاط الولاء");
  }

  const [session, settings] = await Promise.all([
    getActiveSessionForPos(ctx),
    getSessionSettings(),
  ]);
  if (!session) {
    throw new Error("جلسة كاشير نشطة مطلوبة");
  }

  const discount = input.discount ?? 0;
  const overrideThreshold = settings.manager_discount_override_amount;
  if (requiresManagerDiscountOverride(discount, overrideThreshold)) {
    if (!input.override?.discount) {
      throw new Error("Manager override required for this discount");
    }
    if (user.role !== "owner" && user.role !== "manager") {
      throw new Error("Owner or manager override required");
    }
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: ctx.storeId,
      userId: user.id,
      action: "pos.manager_override.discount",
      entityType: "checkout",
      entityId: session.id,
      metadata: {
        cashierId: ctx.activeCashierId,
        discount,
        threshold: overrideThreshold,
        reason: input.override.reason ?? null,
      },
    });
  }
  const lifecycle = computeSessionLifecycle(session, settings);
  if (lifecycle.blocksSales) {
    if (!input.override?.expiredSession) {
      throw new Error("Session expired — close shift to continue");
    }
    if (settings.require_manager_override_for_expired_sale) {
      if (user.role !== "owner" && user.role !== "manager") {
        throw new Error("Owner or manager override required");
      }
      const orgId = await getOrgId();
      await writeAuditLog({
        orgId,
        storeId: ctx.storeId,
        userId: user.id,
        action: "pos.manager_override.expired_session",
        entityType: "checkout",
        entityId: session.id,
        metadata: {
          cashierId: ctx.activeCashierId,
          reason: input.override.reason ?? null,
        },
      });
    }
  }

  const result = await completeCheckout({
    storeId: ctx.storeId,
    sessionId: session.id,
    cashierId: ctx.activeCashierId,
    deviceId: ctx.deviceId,
    cart: input.cart,
    customer: input.customer,
    paymentMethod,
    payments,
    salesMode: input.salesMode ?? "retail",
    discount: input.discount ?? 0,
    loyaltyPoints: input.loyaltyPoints,
    override: {
      expiredSession: input.override?.expiredSession,
    },
  });

  revalidatePath("/orders");
  revalidatePath("/pos");

  return result;
}
