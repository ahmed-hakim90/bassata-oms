import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import {
  getActiveSessions,
  getLiveStats,
  getLowStock,
  getRecentOrders,
  getTopProducts,
} from "@/modules/dashboard/services/dashboard.service";
import { LiveSalesPulse } from "@/modules/dashboard/components/live-sales-pulse";
import { QuickActionsBar } from "@/modules/dashboard/components/quick-actions-bar";
import { ActiveSessionsWidget } from "@/modules/dashboard/components/active-sessions-widget";
import { RecentOrdersFeed } from "@/modules/dashboard/components/recent-orders-feed";
import { TopProductsRanking } from "@/modules/dashboard/components/top-products-ranking";
import { formatCurrency } from "@/lib/format";
import { listStockLevels, listInventoryBatches } from "@/lib/repositories/inventory.repository";
import { listProducts } from "@/lib/repositories/catalog.repository";

export async function DashboardPage() {
  const storeId = await getValidatedActiveStoreId();
  const org = await orgRepo.getOrganization();

  const [stats, lowStock, recentOrders, topProducts, activeSessions, stockLevels, batches, products] =
    await Promise.all([
      getLiveStats(storeId),
      getLowStock(storeId),
      getRecentOrders(storeId),
      getTopProducts(storeId),
      getActiveSessions(storeId),
      listStockLevels(storeId),
      listInventoryBatches(storeId),
      listProducts(),
    ]);

  const productCostMap = new Map(products.map((product) => [product.id, product.base_price]));
  const inventoryValue = stockLevels.reduce((total, level) => {
    const cost = productCostMap.get(level.product_id) ?? 0;
    return total + level.quantity * cost;
  }, 0);
  const grossProfit = Math.max(stats.todaySales - stats.todaySales * 0.62, 0);
  const nearExpiryCount = batches.filter(
    (batch) => Boolean(batch.expiry_date) && !batch.is_expired && batch.remaining_quantity > 0
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="لوحة التحكم"
        description={`${org.name} - مبيعات اليوم والمخزون ونشاط الكاشير`}
      />
      <div className="grid gap-4 rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-transparent to-sky-500/5 p-6 md:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            اليوم
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCurrency(stats.todaySales, org.currency)}
          </p>
          <p className="text-sm text-muted-foreground">{stats.todayOrders} طلب</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            متوسط الفاتورة
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCurrency(stats.avgTicket, org.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            يحتاج متابعة
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{lowStock.length}</p>
          <p className="text-sm text-muted-foreground">أصناف تحت حد إعادة الطلب</p>
        </div>
      </div>
      <QuickActionsBar />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="مبيعات اليوم"
          value={formatCurrency(stats.todaySales, org.currency)}
        />
        <KpiCard
          label="تقدير صافي الربح"
          value={formatCurrency(grossProfit, org.currency)}
        />
        <KpiCard label="قيمة المخزون" value={formatCurrency(inventoryValue, org.currency)} />
        <KpiCard label="الجلسات المفتوحة" value={String(activeSessions.length)} />
        <KpiCard label="مخزون منخفض" value={String(lowStock.length)} />
        <KpiCard label="قريب من الانتهاء" value={String(nearExpiryCount)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveSalesPulse data={stats.salesSparkline} todaySales={stats.todaySales} />
        </div>
        <ActiveSessionsWidget sessions={activeSessions} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentOrdersFeed orders={recentOrders} />
        <TopProductsRanking products={topProducts} currency={org.currency} />
      </div>
    </div>
  );
}
