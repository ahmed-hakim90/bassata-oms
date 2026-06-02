import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import {
  getActiveSessions,
  getLiveStats,
  getLowStock,
  getRecentOrders,
  getSouqnaDashboardData,
  getTopProducts,
} from "@/modules/dashboard/services/dashboard.service";
import { LiveSalesPulse } from "@/modules/dashboard/components/live-sales-pulse";
import { QuickActionsBar } from "@/modules/dashboard/components/quick-actions-bar";
import { ActiveSessionsWidget } from "@/modules/dashboard/components/active-sessions-widget";
import { RecentOrdersFeed } from "@/modules/dashboard/components/recent-orders-feed";
import { TopProductsRanking } from "@/modules/dashboard/components/top-products-ranking";
import { SouqnaOrdersWidget } from "@/modules/dashboard/components/souqna-orders-widget";
import { formatCurrency } from "@/lib/format";

export async function DashboardPage() {
  const storeId = await getValidatedActiveStoreId();
  const org = await orgRepo.getOrganization();

  const [stats, lowStock, recentOrders, topProducts, activeSessions, souqnaData] =
    await Promise.all([
      getLiveStats(storeId),
      getLowStock(storeId),
      getRecentOrders(storeId),
      getTopProducts(storeId),
      getActiveSessions(storeId),
      getSouqnaDashboardData(storeId),
    ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`${org.name} — executive overview and live store pulse`}
      />
      <div className="grid gap-4 rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-transparent to-sky-500/5 p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Today
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCurrency(stats.todaySales, org.currency)}
          </p>
          <p className="text-sm text-muted-foreground">{stats.todayOrders} orders</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Avg ticket
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCurrency(stats.avgTicket, org.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Attention
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{lowStock.length}</p>
          <p className="text-sm text-muted-foreground">SKUs below reorder</p>
        </div>
      </div>
      <QuickActionsBar />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Today's sales"
          value={formatCurrency(stats.todaySales, org.currency)}
        />
        <KpiCard label="Orders today" value={String(stats.todayOrders)} />
        <KpiCard
          label="Avg ticket"
          value={formatCurrency(stats.avgTicket, org.currency)}
        />
        <KpiCard label="Low stock SKUs" value={String(lowStock.length)} />
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
      <SouqnaOrdersWidget
        pendingCount={souqnaData.pendingCount}
        recentOrders={souqnaData.recentOrders}
        currency={org.currency}
      />
    </div>
  );
}
