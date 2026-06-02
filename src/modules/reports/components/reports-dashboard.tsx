"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportReportsAction } from "@/modules/reports/actions/reports.actions";
import type { Store } from "@/lib/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DollarSign, Package, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { formatCurrency } from "@/lib/format";
import type { ProductProfitRow } from "@/modules/reports/services/profitability-report.service";
import type { InventoryKpi } from "@/modules/reports/services/inventory-report.service";
import type { SalesKpi } from "@/modules/reports/services/sales-report.service";
import type { SessionKpi } from "@/modules/reports/services/session-report.service";

type AccountingData = {
  profit: Awaited<ReturnType<typeof import("@/modules/reports/services/profit-report.service").getProfitReport>>;
  expensesByCenter: Awaited<ReturnType<typeof import("@/modules/reports/services/expense-report.service").getExpensesByCostCenter>>;
  expensesByStore: Awaited<ReturnType<typeof import("@/modules/reports/services/expense-report.service").getExpensesByStore>>;
  expensesByCategory: Awaited<ReturnType<typeof import("@/modules/reports/services/expense-report.service").getExpensesByCategory>>;
  expensesByCategoryTrend: Awaited<ReturnType<typeof import("@/modules/reports/services/expense-report.service").getExpensesByCategoryWithTrend>>;
  sessionExpenses: Awaited<ReturnType<typeof import("@/modules/reports/services/expense-report.service").getSessionExpensesReport>>;
  topExpenses: Awaited<ReturnType<typeof import("@/modules/reports/services/expense-report.service").getTopExpenses>>;
  highestWaste: Awaited<ReturnType<typeof import("@/modules/reports/services/profit-report.service").getHighestWasteReport>>;
  productRankings: Awaited<ReturnType<typeof import("@/modules/reports/services/profit-report.service").getProductRankings>>;
};

interface ReportsDashboardProps {
  sales: SalesKpi;
  profitability: ProductProfitRow[];
  inventory: InventoryKpi;
  sessions: SessionKpi;
  accounting: AccountingData | null;
  currency: string;
  days: number;
  stores: Store[];
  filterStoreId: string;
  customFrom: string;
  customTo: string;
  showCosts: boolean;
  customerAccounts: {
    outstanding: { id: string; name: string; phone: string; account_balance: number }[];
    aging: { total: number; buckets: Record<string, number> };
  } | null;
}

export function ReportsDashboard({
  sales,
  profitability,
  inventory,
  sessions,
  accounting,
  currency,
  days,
  stores,
  filterStoreId,
  customFrom,
  customTo,
  showCosts,
  customerAccounts,
}: ReportsDashboardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const chartData = sales.revenueByDay.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  const PIE_COLORS = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DC2626", "#64748B"];

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Executive insights across ${days} days`}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {[7, 30, 90].map((value) => (
            <Link
              key={value}
              href={`/reports?days=${value}&storeId=${filterStoreId}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                days === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {value}d
            </Link>
          ))}
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const from = fd.get("from")?.toString();
            const to = fd.get("to")?.toString();
            const params = new URLSearchParams();
            params.set("storeId", filterStoreId);
            if (from) params.set("from", from);
            if (to) params.set("to", to);
            else params.set("days", String(days));
            router.push(`/reports?${params.toString()}`);
          }}
        >
          <Input
            type="date"
            name="from"
            defaultValue={customFrom}
            className="h-9 w-36 rounded-full"
          />
          <Input
            type="date"
            name="to"
            defaultValue={customTo}
            className="h-9 w-36 rounded-full"
          />
          <Button type="submit" size="sm" variant="outline" className="rounded-full">
            Custom range
          </Button>
        </form>
        <select
          className="h-9 rounded-full border border-input bg-background px-3 text-sm"
          value={filterStoreId}
          onChange={(e) => {
            const params = new URLSearchParams();
            params.set("days", String(days));
            params.set("storeId", e.target.value);
            if (customFrom) params.set("from", customFrom);
            if (customTo) params.set("to", customTo);
            router.push(`/reports?${params.toString()}`);
          }}
        >
          <option value="all">All stores</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              try {
                const file = await exportReportsAction(
                  days,
                  filterStoreId,
                  customFrom ? { from: customFrom, to: customTo || undefined } : undefined
                );
                const link = document.createElement("a");
                link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${file.base64}`;
                link.download = file.filename;
                link.click();
                toast.success("Report exported");
              } catch {
                toast.error("Export failed");
              }
            });
          }}
        >
          <Download className="size-4" />
          Export
        </Button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Revenue"
          value={formatCurrency(sales.totalRevenue, currency)}
          icon={<DollarSign className="size-5" />}
          trend="up"
        />
        {showCosts ? (
          <>
            <KpiCard
              label="COGS"
              value={formatCurrency(sales.totalCost, currency)}
              icon={<Package className="size-5" />}
            />
            <KpiCard
              label="Gross profit"
              value={formatCurrency(sales.grossProfit, currency)}
              icon={<TrendingUp className="size-5" />}
            />
            <KpiCard
              label="Avg margin"
              value={`${sales.avgMargin.toFixed(1)}%`}
              icon={<Users className="size-5" />}
            />
          </>
        ) : (
          <>
            <KpiCard
              label="Orders"
              value={String(sales.orderCount)}
              icon={<TrendingUp className="size-5" />}
            />
            <KpiCard
              label="Inventory Value"
              value={formatCurrency(inventory.valuationEstimate, currency)}
              icon={<Package className="size-5" />}
            />
            <KpiCard
              label="Open Sessions"
              value={String(sessions.openSessions)}
              icon={<Users className="size-5" />}
            />
          </>
        )}
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <OperationalCard title="Revenue Trend">
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v), currency)}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No sales data yet — complete POS orders to see trends
              </div>
            )}
          </div>
        </OperationalCard>

        <OperationalCard title="Revenue by Store">
          <div className="h-64 min-w-0">
            {sales.revenueByStore.some((s) => s.revenue > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sales.revenueByStore}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="storeName" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v), currency)}
                  />
                  <Bar dataKey="revenue" fill="#2563EB" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No revenue by store yet — complete POS orders to compare branches
              </div>
            )}
          </div>
        </OperationalCard>

        <OperationalCard title="Top Products">
          {sales.topProducts.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No data yet</p>
          ) : (
            <ul className="space-y-3">
              {sales.topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-4">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.quantity} sold
                      {showCosts
                        ? ` · margin ${p.margin.toFixed(1)}%`
                        : null}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">
                      {formatCurrency(p.revenue, currency)}
                    </span>
                    {showCosts ? (
                      <p className="text-xs text-muted-foreground">
                        profit {formatCurrency(p.profit, currency)}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </OperationalCard>

        {sales.topVariants.length > 0 ? (
          <OperationalCard title="Top Variants">
            <ul className="space-y-3">
              {sales.topVariants.map((v, i) => (
                <li key={`${v.productName}-${v.name}`} className="flex items-center gap-4">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">
                      {v.productName} — {v.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{v.quantity} sold</p>
                  </div>
                  <span className="font-semibold">{formatCurrency(v.revenue, currency)}</span>
                </li>
              ))}
            </ul>
          </OperationalCard>
        ) : null}

        {showCosts && profitability.length > 0 ? (
          <OperationalCard title="Product Profitability">
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {profitability.slice(0, 10).map((row) => (
                <li
                  key={row.productId}
                  className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 text-sm last:border-0"
                >
                  <span className="font-medium">{row.name}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(row.profit, currency)} ({row.margin.toFixed(1)}%)
                  </span>
                </li>
              ))}
            </ul>
          </OperationalCard>
        ) : null}

        <OperationalCard title="Inventory Health">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-semibold">{inventory.totalUnits}</p>
              <p className="text-xs text-muted-foreground">Total Units</p>
            </div>
            <div className="rounded-2xl bg-amber-500/10 p-4 text-center">
              <p className="text-2xl font-semibold text-amber-700">
                {inventory.lowStockCount}
              </p>
              <p className="text-xs text-muted-foreground">Low Stock</p>
            </div>
            <div className="rounded-2xl bg-red-500/10 p-4 text-center">
              <p className="text-2xl font-semibold text-red-700">
                {inventory.outOfStockCount}
              </p>
              <p className="text-xs text-muted-foreground">Out of Stock</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-semibold">{inventory.totalSkus}</p>
              <p className="text-xs text-muted-foreground">SKUs Tracked</p>
            </div>
          </div>
        </OperationalCard>
      </div>

      {showCosts && accounting ? (
        <>
          <h2 className="mb-4 mt-10 text-xl font-semibold">Accounting</h2>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total expenses"
              value={formatCurrency(accounting.profit.totalExpenses, currency)}
              icon={<DollarSign className="size-5" />}
            />
            <KpiCard
              label="Waste cost"
              value={formatCurrency(accounting.profit.wasteCost, currency)}
              icon={<Package className="size-5" />}
            />
            <KpiCard
              label="Est. net profit"
              value={formatCurrency(accounting.profit.estimatedNetProfit, currency)}
              icon={<TrendingUp className="size-5" />}
            />
            <KpiCard
              label="Refunds"
              value={formatCurrency(accounting.profit.refunds, currency)}
              icon={<Users className="size-5" />}
            />
          </div>

          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <OperationalCard title="Expenses by Cost Center">
              <div className="h-64">
                {accounting.expensesByStore.length > 0 ? (
                  <OperationalCard title="Expenses by store">
                    <ul className="space-y-2">
                      {accounting.expensesByStore.map((s) => (
                        <li key={s.storeId} className="flex justify-between text-sm">
                          <span>{s.storeName}</span>
                          <span className="font-medium tabular-nums">
                            {formatCurrency(s.amount, currency)} ({s.percentage.toFixed(0)}%)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </OperationalCard>
                ) : null}
                {accounting.expensesByCenter.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={accounting.expensesByCenter}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                      >
                        {accounting.expensesByCenter.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v), currency)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No expense data yet
                  </div>
                )}
              </div>
            </OperationalCard>

            <OperationalCard title="Expenses by Category">
              <div className="h-64">
                {accounting.expensesByCategoryTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accounting.expensesByCategoryTrend.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                      <YAxis className="text-xs" />
                      <Tooltip
                        formatter={(v, name) =>
                          name === "trendPct"
                            ? `${Number(v).toFixed(1)}%`
                            : formatCurrency(Number(v), currency)
                        }
                      />
                      <Bar dataKey="amount" fill="#7C3AED" radius={[8, 8, 0, 0]} name="Current" />
                      <Bar dataKey="priorAmount" fill="#94A3B8" radius={[8, 8, 0, 0]} name="Prior" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : accounting.expensesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accounting.expensesByCategory.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                      <YAxis className="text-xs" />
                      <Tooltip formatter={(v) => formatCurrency(Number(v), currency)} />
                      <Bar dataKey="amount" fill="#7C3AED" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No category data yet
                  </div>
                )}
              </div>
              {accounting.expensesByCategoryTrend.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {accounting.expensesByCategoryTrend.slice(0, 5).map((c) => (
                    <li key={c.categoryId} className="flex justify-between">
                      <span>{c.name}</span>
                      <span className={c.trendPct >= 0 ? "text-destructive" : "text-emerald-600"}>
                        {c.trendPct >= 0 ? "+" : ""}
                        {c.trendPct.toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </OperationalCard>

            <OperationalCard title="Top Expenses">
              <ul className="space-y-2 text-sm">
                {accounting.topExpenses.highestCostCenter && (
                  <li className="flex justify-between">
                    <span>Highest cost center</span>
                    <span className="font-medium">
                      {accounting.topExpenses.highestCostCenter.name} —{" "}
                      {formatCurrency(accounting.topExpenses.highestCostCenter.amount, currency)}
                    </span>
                  </li>
                )}
                {accounting.topExpenses.highestCategory && (
                  <li className="flex justify-between">
                    <span>Highest category</span>
                    <span className="font-medium">
                      {accounting.topExpenses.highestCategory.name} —{" "}
                      {formatCurrency(accounting.topExpenses.highestCategory.amount, currency)}
                    </span>
                  </li>
                )}
                {accounting.topExpenses.highestSingle && (
                  <li className="flex justify-between">
                    <span>Largest single expense</span>
                    <span className="font-medium">
                      {accounting.topExpenses.highestSingle.title} —{" "}
                      {formatCurrency(accounting.topExpenses.highestSingle.amount, currency)}
                    </span>
                  </li>
                )}
              </ul>
            </OperationalCard>

            <OperationalCard title="Highest Waste">
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {accounting.highestWaste.slice(0, 5).map((w) => (
                  <li key={w.productId} className="flex justify-between gap-2">
                    <span>{w.name} ({w.quantity} units)</span>
                    <span className="font-medium">{formatCurrency(w.cost, currency)}</span>
                  </li>
                ))}
                {accounting.highestWaste.length === 0 && (
                  <p className="text-muted-foreground">No waste recorded</p>
                )}
              </ul>
            </OperationalCard>

            <OperationalCard title="Session Expenses" className="lg:col-span-2">
              <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                {accounting.sessionExpenses.slice(0, 10).map((s) => (
                  <li key={s.sessionId} className="flex justify-between border-b border-border/50 pb-2">
                    <span>{s.cashierName} · {s.expenses.length} items</span>
                    <span className="font-medium">{formatCurrency(s.total, currency)}</span>
                  </li>
                ))}
                {accounting.sessionExpenses.length === 0 && (
                  <p className="text-muted-foreground">No session expenses</p>
                )}
              </ul>
            </OperationalCard>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <OperationalCard title="Highest Profit Products">
              <ul className="space-y-2 text-sm">
                {accounting.productRankings.highestProfit.slice(0, 5).map((p) => (
                  <li key={p.productId} className="flex justify-between gap-2">
                    <span>{p.name}</span>
                    <span className="font-medium text-emerald-600">
                      {formatCurrency(p.profit, currency)}
                      {p.margin != null ? ` (${p.margin.toFixed(0)}%)` : ""}
                    </span>
                  </li>
                ))}
                {accounting.productRankings.highestProfit.length === 0 && (
                  <p className="text-muted-foreground">No product data yet</p>
                )}
              </ul>
            </OperationalCard>

            <OperationalCard title="Highest Cost Products">
              <ul className="space-y-2 text-sm">
                {accounting.productRankings.highestCost.slice(0, 5).map((p) => (
                  <li key={p.productId} className="flex justify-between gap-2">
                    <span>{p.name}</span>
                    <span className="font-medium">
                      {formatCurrency(p.cost, currency)}
                    </span>
                  </li>
                ))}
                {accounting.productRankings.highestCost.length === 0 && (
                  <p className="text-muted-foreground">No product data yet</p>
                )}
              </ul>
            </OperationalCard>
          </div>
        </>
      ) : null}

      {customerAccounts ? (
        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">Customer accounts</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Outstanding AR"
              value={formatCurrency(customerAccounts.aging.total, currency)}
            />
            <KpiCard
              label="0–30 days"
              value={formatCurrency(customerAccounts.aging.buckets.current, currency)}
            />
            <KpiCard
              label="31–60 days"
              value={formatCurrency(customerAccounts.aging.buckets.days30, currency)}
            />
            <KpiCard
              label="90+ days"
              value={formatCurrency(customerAccounts.aging.buckets.over90, currency)}
            />
          </div>
          <OperationalCard title="Outstanding balances">
            <ul className="space-y-2 text-sm">
              {customerAccounts.outstanding.length === 0 ? (
                <li className="text-muted-foreground">No open balances</li>
              ) : (
                customerAccounts.outstanding.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <span className="tabular-nums">{formatCurrency(c.account_balance, currency)}</span>
                  </li>
                ))
              )}
            </ul>
          </OperationalCard>
        </section>
      ) : null}
    </>
  );
}
