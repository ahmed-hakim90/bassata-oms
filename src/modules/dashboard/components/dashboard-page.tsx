import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureTenantUser } from "@/lib/auth/ensure-tenant-user";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import {
  getActiveSessions,
  getDashboardInventory,
  getDashboardSales,
  getMonthToDateSales,
  getOwnerFinanceSnapshot,
} from "@/modules/dashboard/services/dashboard.service";
import { LiveSalesPulse } from "@/modules/dashboard/components/live-sales-pulse";
import { QuickActionsBar } from "@/modules/dashboard/components/quick-actions-bar";
import { ActiveSessionsWidget } from "@/modules/dashboard/components/active-sessions-widget";
import { RecentOrdersFeed } from "@/modules/dashboard/components/recent-orders-feed";
import { TopProductsRanking } from "@/modules/dashboard/components/top-products-ranking";
import { OwnerFinanceOverview } from "@/modules/dashboard/components/owner-finance-overview";
import { formatCurrency } from "@/lib/format";

export async function DashboardPage() {
  const user = await ensureTenantUser(await getCurrentUser());
  const isOwner = user.role === "owner";
  const store = await requirePageStoreId("/");
  if (!store.ok) {
    return <AccessDenied title={store.denial.title} description={store.denial.description} />;
  }
  const storeId = store.storeId;
  const org = await orgRepo.getOrganization();

  const products = await catalogRepo.listProducts();
  const [sales, inventory, activeSessions, monthSales, finance] = await Promise.all([
    getDashboardSales(storeId, { products }),
    getDashboardInventory(storeId, products),
    getActiveSessions(storeId),
    isOwner ? getMonthToDateSales(storeId) : Promise.resolve(null),
    isOwner ? getOwnerFinanceSnapshot(storeId) : Promise.resolve(null),
  ]);

  const { stats, topProducts, recentOrders } = sales;
  const { lowStock, inventoryValue, nearExpiryCount } = inventory;

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        breadcrumb={<span>الرئيسية</span>}
        title="لوحة التحكم"
        description={
          isOwner
            ? `${org.name} — مبيعات اليوم والشهر والمستحقات`
            : `${org.name} — مبيعات اليوم والمخزون ونشاط الكاشير`
        }
      />

      {isOwner && monthSales && finance ? (
        <OwnerFinanceOverview
          currency={org.currency}
          today={{
            revenue: stats.todaySales,
            orderCount: stats.todayOrders,
            avgTicket: stats.avgTicket,
          }}
          month={monthSales}
          finance={finance}
        />
      ) : (
        <OperationalCard>
          <div className="grid gap-[var(--mds-space-6)] sm:grid-cols-3">
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
        </OperationalCard>
      )}

      <QuickActionsBar />

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="مبيعات اليوم"
          value={formatCurrency(stats.todaySales, org.currency)}
        />
        <KpiCard label="طلبات اليوم" value={String(stats.todayOrders)} />
        <KpiCard label="قيمة المخزون" value={formatCurrency(inventoryValue, org.currency)} />
        <KpiCard label="الجلسات المفتوحة" value={String(activeSessions.length)} />
        <KpiCard label="مخزون منخفض" value={String(lowStock.length)} />
        <KpiCard label="قريب من الانتهاء" value={String(nearExpiryCount)} />
      </div>

      <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveSalesPulse data={stats.salesSparkline} todaySales={stats.todaySales} />
        </div>
        <ActiveSessionsWidget sessions={activeSessions} />
      </div>

      <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-2">
        <RecentOrdersFeed orders={recentOrders} />
        <TopProductsRanking products={topProducts} currency={org.currency} />
      </div>
    </div>
  );
}
