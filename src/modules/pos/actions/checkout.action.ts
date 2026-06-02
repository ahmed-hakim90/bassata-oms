"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import { requirePosAccess } from "@/lib/auth/pos-access";
import { completeCheckout } from "@/modules/pos/services/checkout.service";
import { getActiveSessionForPos } from "@/lib/auth/pos-access";
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
  override?: CheckoutOverride;
}) {
  const user = await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  const ctx = await requirePosAccess();
  await requireFeature("inventory_deduction");
  const payments = input.payments?.length
    ? input.payments
    : [{ method: input.paymentMethod, amount: 0 }];
  const usesCredit = payments.some((payment) => payment.method === "credit");

  if (usesCredit) {
    await requireFeature("credit_sales");
    await requirePermissionOrRole("customer_credit_sale", ["owner", "manager", "cashier"]);
    if (!input.customer) {
      throw new Error("Select a customer for credit sale");
    }
  } else {
    for (const payment of payments) {
      await requireFeature(`payment_${payment.method}` as FeatureFlag);
    }
  }
  if ((input.discount ?? 0) > 0) {
    await requireFeature("customer_discounts");
  }
  if ((input.salesMode ?? "retail") === "wholesale") {
    await requireFeature("wholesale_sales");
    await requirePermissionOrRole("wholesale_sale", ["owner", "manager", "cashier"]);
  }
  if (input.cart.some((line) => line.saleInputMode === "by_weight")) {
    await requireFeature("weight_sales");
    await requirePermissionOrRole("weight_sale", ["owner", "manager", "cashier"]);
  }
  if (input.cart.some((line) => line.saleInputMode === "by_amount")) {
    await requireFeature("price_by_amount");
    await requirePermissionOrRole("price_by_amount_sale", ["owner", "manager", "cashier"]);
  }

  const session = await getActiveSessionForPos(ctx);
  if (!session) {
    throw new Error("Active cashier session required");
  }

  const settings = await getSessionSettings();
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
    paymentMethod: input.paymentMethod,
    payments: input.payments,
    salesMode: input.salesMode ?? "retail",
    discount: input.discount ?? 0,
    override: {
      expiredSession: input.override?.expiredSession,
    },
  });

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/pos");

  return result;
}
