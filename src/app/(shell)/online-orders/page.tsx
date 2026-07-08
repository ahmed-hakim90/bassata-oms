import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OnlineOrdersPageClient } from "@/modules/online-orders/components/online-orders-page";
import {
  listOnlineOrdersWithItems,
  listStaffOnlineProductOptions,
} from "@/modules/online-orders/services/online-order.service";
import { getFeatureFlags } from "@/modules/system/services/settings.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import type { PaymentMethod } from "@/lib/types";

export default async function OnlineOrdersRoute() {
  const storeId = await getValidatedActiveStoreId();
  const [orders, products, flags, receiptBranding] = await Promise.all([
    listOnlineOrdersWithItems(storeId),
    listStaffOnlineProductOptions(),
    getFeatureFlags(),
    getReportBranding(storeId),
  ]);
  const enabledPaymentMethods: PaymentMethod[] = [
    flags.payment_cash ? "cash" : null,
    flags.payment_card ? "card" : null,
    flags.payment_wallet ? "wallet" : null,
    flags.payment_other ? "other" : null,
    flags.credit_sales ? "credit" : null,
  ].filter((method): method is PaymentMethod => Boolean(method));

  return (
    <div className="space-y-6">
      <PageHeader
        title="طلبات المنيو الأونلاين"
        description="راجع الطلبات القادمة من الرابط العام، عدّلها أو ألغها أو حوّلها إلى فاتورة."
      />
      <OnlineOrdersPageClient
        orders={orders}
        products={products}
        enabledPaymentMethods={enabledPaymentMethods}
        receiptBranding={receiptBranding}
      />
    </div>
  );
}
