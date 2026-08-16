import { AccessDenied } from "@/components/Velora/access-denied";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/Velora/page-header";
import { OnlineOrdersPageClient } from "@/modules/online-orders/components/online-orders-page";
import { OnlineOrdersAnalyticsGlance } from "@/modules/online-orders/components/online-orders-analytics-glance";
import {
  listOnlineOrdersWithItems,
  listStaffOnlineProductOptions,
} from "@/modules/online-orders/services/online-order.service";
import { buildOnlineOrdersGlance } from "@/modules/online-orders/lib/online-orders-glance";
import { getOnlineMenuViewStats } from "@/modules/online-menu/services/online-menu-views.service";
import { enabledPaymentMethodsFromFlags } from "@/lib/enabled-payment-methods";
import { getFeatureFlags } from "@/modules/system/services/settings.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";

export default async function OnlineOrdersRoute() {
  const store = await requirePageStoreId("/online-orders");
  if (!store.ok) {
    return <AccessDenied title={store.denial.title} description={store.denial.description} />;
  }
  const storeId = store.storeId;
  const [orders, products, flags, receiptBranding, menuViewStats] = await Promise.all([
    listOnlineOrdersWithItems(storeId),
    listStaffOnlineProductOptions(),
    getFeatureFlags(),
    getReportBranding(storeId),
    getOnlineMenuViewStats(storeId, 7),
  ]);
  const enabledPaymentMethods = enabledPaymentMethodsFromFlags(flags);
  const glance = buildOnlineOrdersGlance({ orders, menuViewStats });

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="طلبات الأونلاين"
        description="قبول · تحضير · جاهز · ريسيت — من رابط المنيو العام."
      />
      <OnlineOrdersAnalyticsGlance
        glance={glance}
        currency={receiptBranding.currency}
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
