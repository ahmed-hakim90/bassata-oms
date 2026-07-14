import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OnlineOrdersPageClient } from "@/modules/online-orders/components/online-orders-page";
import {
  listOnlineOrdersWithItems,
  listStaffOnlineProductOptions,
} from "@/modules/online-orders/services/online-order.service";
import { enabledPaymentMethodsFromFlags } from "@/lib/enabled-payment-methods";
import { getFeatureFlags } from "@/modules/system/services/settings.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";

export default async function OnlineOrdersRoute() {
  const store = await requirePageStoreId("/online-orders");
  if (!store.ok) {
    return <AccessDenied title={store.denial.title} description={store.denial.description} />;
  }
  const storeId = store.storeId;
  const [orders, products, flags, receiptBranding] = await Promise.all([
    listOnlineOrdersWithItems(storeId),
    listStaffOnlineProductOptions(),
    getFeatureFlags(),
    getReportBranding(storeId),
  ]);
  const enabledPaymentMethods = enabledPaymentMethodsFromFlags(flags);

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
