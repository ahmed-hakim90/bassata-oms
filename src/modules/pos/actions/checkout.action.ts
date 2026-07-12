"use server";

import { revalidatePath } from "next/cache";
import { requireFeatures, requirePermissionOrRole } from "@/lib/auth/guards";
import { requirePosAccess, getActiveSessionForPos } from "@/lib/auth/pos-access";
import { completeCheckout, type CheckoutResult } from "@/modules/pos/services/checkout.service";
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

export type CheckoutActionResult =
  | ({ success: true } & CheckoutResult)
  | { success: false; error: string };

export async function checkoutAction(input: {
  cart: CartLine[];
  customer: Customer | null;
  paymentMethod: PaymentMethod;
  payments?: PaymentSplit[];
  salesMode?: SalesMode;
  discount?: number;
  loyaltyPoints?: number;
  override?: CheckoutOverride;
}): Promise<CheckoutActionResult> {
  try {
    const user = await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
    const ctx = await requirePosAccess();
    const payments = (input.payments?.length
      ? input.payments
      : [{ method: input.paymentMethod, amount: 0 }]
    ).filter((payment) => payment.amount > 0);
    if (!payments.length) {
      return { success: false, error: "أدخل مبلغ دفع صالحاً" };
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
        return { success: false, error: "اختر عميلًا للبيع الآجل" };
      }
    }
    if ((input.loyaltyPoints ?? 0) > 0 && !input.customer) {
      return { success: false, error: "اختر عميلاً لاستبدال نقاط الولاء" };
    }

    const [session, settings] = await Promise.all([
      getActiveSessionForPos(ctx),
      getSessionSettings(),
    ]);
    if (!session) {
      return { success: false, error: "جلسة كاشير نشطة مطلوبة" };
    }

    const discount = input.discount ?? 0;
    const overrideThreshold = settings.manager_discount_override_amount;
    if (requiresManagerDiscountOverride(discount, overrideThreshold)) {
      if (!input.override?.discount) {
        return { success: false, error: "هذا الخصم يحتاج موافقة المدير" };
      }
      if (user.role !== "owner" && user.role !== "manager") {
        return { success: false, error: "موافقة المالك أو المدير مطلوبة" };
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
        return { success: false, error: "انتهت الجلسة — أغلق الوردية للمتابعة" };
      }
      if (settings.require_manager_override_for_expired_sale) {
        if (user.role !== "owner" && user.role !== "manager") {
          return { success: false, error: "موافقة المالك أو المدير مطلوبة" };
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
    // Avoid revalidatePath("/pos") — remounting POS mid-sale surfaces Next.js
    // production digests and can freeze/interrupt the cashier screen.

    return { success: true, ...result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "فشل إتمام البيع",
    };
  }
}
