import { after } from "next/server";
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

export type CheckoutOverride = {
  discount?: boolean;
  expiredSession?: boolean;
  reason?: string;
};

export type CheckoutFlowResult =
  | ({ success: true } & CheckoutResult)
  | { success: false; error: string };

export type CheckoutFlowInput = {
  cart: CartLine[];
  customer: Customer | null;
  paymentMethod: PaymentMethod;
  payments?: PaymentSplit[];
  salesMode?: SalesMode;
  discount?: number;
  couponCode?: string | null;
  loyaltyPoints?: number;
  override?: CheckoutOverride;
};

/** Shared POS checkout used by API route (and legacy server action). */
export async function executePosCheckout(input: CheckoutFlowInput): Promise<CheckoutFlowResult> {
  try {
    const [user, ctx] = await Promise.all([
      requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]),
      requirePosAccess({ touchSeen: false }),
    ]);
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

    const featuresPromise = requireFeatures([...new Set(featureChecks)]);
    const creditPromise = usesCredit
      ? requirePermissionOrRole("customer_credit_sale", ["owner", "manager", "cashier"])
      : Promise.resolve(user);

    if (usesCredit && !input.customer) {
      return { success: false, error: "اختر عميلًا للبيع الآجل" };
    }
    if ((input.loyaltyPoints ?? 0) > 0 && !input.customer) {
      return { success: false, error: "اختر عميلاً لاستبدال نقاط الولاء" };
    }

    const [, , session, settings] = await Promise.all([
      featuresPromise,
      creditPromise,
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
      couponCode: input.couponCode,
      loyaltyPoints: input.loyaltyPoints,
      session,
      sessionGateChecked: true,
      override: {
        expiredSession: input.override?.expiredSession,
      },
    });

    after(() => {
      revalidatePath("/orders");
    });

    return { success: true, ...result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "فشل إتمام البيع",
    };
  }
}
