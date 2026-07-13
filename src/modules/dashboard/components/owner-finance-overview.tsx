import Link from "next/link";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { formatCurrency } from "@/lib/format";
import type {
  OwnerFinanceSnapshot,
  PeriodSalesSummary,
} from "@/modules/dashboard/services/dashboard.service";

interface OwnerFinanceOverviewProps {
  currency: string;
  today: PeriodSalesSummary;
  month: PeriodSalesSummary;
  finance: OwnerFinanceSnapshot;
}

export function OwnerFinanceOverview({
  currency,
  today,
  month,
  finance,
}: OwnerFinanceOverviewProps) {
  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <OperationalCard>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              نظرة المالك
            </p>
            <h2 className="mt-1 text-lg font-semibold">المبيعات والمستحقات</h2>
          </div>
          <Link
            href="/reports"
            className="text-sm font-medium text-[var(--mds-color-action-primary)] hover:underline"
          >
            التقارير التفصيلية
          </Link>
        </div>

        <div className="grid gap-[var(--mds-space-6)] sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              اليوم
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(today.revenue, currency)}
            </p>
            <p className="text-sm text-muted-foreground">
              {today.orderCount} طلب · متوسط{" "}
              {formatCurrency(today.avgTicket, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              الشهر الحالي
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(month.revenue, currency)}
            </p>
            <p className="text-sm text-muted-foreground">
              {month.orderCount} طلب · متوسط{" "}
              {formatCurrency(month.avgTicket, currency)}
            </p>
          </div>
        </div>
      </OperationalCard>

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="مستحق عملاء"
          value={formatCurrency(finance.customerOutstanding, currency)}
          change="رصيد آجل حالي"
          trend="neutral"
        />
        <KpiCard
          label="تحصيلات الشهر"
          value={formatCurrency(finance.customerCollectionsMtd, currency)}
          change="مدفوعات عملاء هذا الشهر"
          trend="neutral"
        />
        <KpiCard
          label="مستحق موردين"
          value={formatCurrency(finance.supplierOutstanding, currency)}
          change="رصيد AP حالي"
          trend="neutral"
        />
        <KpiCard
          label="مدفوعات الموردين الشهر"
          value={formatCurrency(finance.supplierPaymentsMtd, currency)}
          change="دفعات غير ملغاة"
          trend="neutral"
        />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/customers"
          className="rounded-[var(--mds-radius-lg)] bg-card px-3 py-2 font-medium ring-1 ring-border hover:bg-muted"
        >
          العملاء والمستحقات
        </Link>
        <Link
          href="/inventory/suppliers"
          className="rounded-[var(--mds-radius-lg)] bg-card px-3 py-2 font-medium ring-1 ring-border hover:bg-muted"
        >
          الموردون والدفعات
        </Link>
        <Link
          href="/reports/aging"
          className="rounded-[var(--mds-radius-lg)] bg-card px-3 py-2 font-medium ring-1 ring-border hover:bg-muted"
        >
          تقرير التقادم
        </Link>
      </div>
    </div>
  );
}
