"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleDollarSign, MinusCircle, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import type { Store } from "@/lib/types";
import { exportIncomeStatementExcel } from "@/modules/accounting/actions/gl-export.actions";
import { AccountingStoreSelect } from "@/modules/accounting/components/accounting-store-select";
import { AccountingSubnav } from "@/modules/accounting/components/accounting-subnav";
import type { IncomeStatementResult } from "@/modules/accounting/services/income-statement.service";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";

interface IncomeStatementPageProps {
  result: IncomeStatementResult;
  stores: Store[];
  storeId: string;
  currency: string;
}

export function IncomeStatementPage({
  result,
  stores,
  storeId,
  currency,
}: IncomeStatementPageProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(result.from);
  const [to, setTo] = useState(result.to);
  const [selectedStore, setSelectedStore] = useState(storeId);

  const applyFilters = () => {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    params.set("storeId", selectedStore);
    startTransition(() => {
      router.push(`/accounting/income-statement?${params.toString()}`);
    });
  };

  const empty =
    result.revenueLines.length === 0 && result.expenseLines.length === 0;

  return (
    <>
      <PageHeader
        title="قائمة الدخل"
        description="الإيرادات والمصروفات من القيود المرحلة — خصم المبيعات يقلل صافي الإيراد"
        action={
          <ExportButtonGroup
            canPrint={false}
            canPdf={false}
            canExcel
            pending={pending}
            onExportExcel={() => {
              startTransition(async () => {
                try {
                  const file = await exportIncomeStatementExcel({
                    from,
                    to,
                    storeId: selectedStore,
                  });
                  downloadBase64Excel(file.base64, file.filename);
                  toast.success("تم تصدير Excel");
                } catch {
                  toast.error("فشل التصدير");
                }
              });
            }}
          />
        }
      />

      <div className="mb-4">
        <AccountingSubnav />
      </div>

      <div className="mb-4 grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="إجمالي الإيراد"
          value={formatCurrency(result.grossRevenue, currency)}
          trend="up"
          icon={<TrendingUp className="size-5" />}
        />
        <KpiCard
          label="خصم المبيعات"
          value={formatCurrency(result.salesDiscounts, currency)}
          trend={result.salesDiscounts > 0 ? "down" : "neutral"}
          icon={<MinusCircle className="size-5" />}
        />
        <KpiCard
          label="المصروفات"
          value={formatCurrency(result.totalExpenses, currency)}
          trend="down"
          icon={<TrendingDown className="size-5" />}
        />
        <KpiCard
          label="صافي الربح / الخسارة"
          value={formatCurrency(result.netIncome, currency)}
          change={result.netIncome >= 0 ? "ربح الفترة" : "خسارة الفترة"}
          trend={result.netIncome >= 0 ? "up" : "down"}
          icon={<CircleDollarSign className="size-5" />}
        />
      </div>

      <OperationalCard title="الفترة">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="is-from">من</Label>
            <Input
              id="is-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full min-w-0"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="is-to">إلى</Label>
            <Input
              id="is-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full min-w-0"
            />
          </div>
          <AccountingStoreSelect
            id="is-store"
            stores={stores}
            value={selectedStore}
            onValueChange={setSelectedStore}
          />
          <div className="flex items-end">
            <Button type="button" disabled={pending} onClick={applyFilters}>
              عرض
            </Button>
          </div>
        </div>
      </OperationalCard>

      <OperationalCard
        title="النتيجة"
        description={`${result.from} → ${result.to}`}
      >
        {empty ? (
          <EmptyStateBlock
            title="مفيش بيانات"
            description="مفيش قيود إيراد أو مصروف مرحلة في الفترة دي."
          />
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 text-sm font-medium">الإيرادات</h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">الكود</th>
                      <th className="px-3 py-2 text-start font-medium">الحساب</th>
                      <th className="px-3 py-2 text-start font-medium">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.revenueLines
                      .filter((line) => !line.isContraRevenue)
                      .map((line) => (
                        <tr key={line.accountId} className="border-t">
                          <td className="px-3 py-2 font-mono tabular-nums">
                            <Link
                              href={`/accounting/ledger?accountId=${line.accountId}&from=${result.from}&to=${result.to}&storeId=${selectedStore}`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {line.code}
                            </Link>
                          </td>
                          <td className="px-3 py-2">{line.name}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatCurrency(line.amount, currency)}
                          </td>
                        </tr>
                      ))}
                    {result.salesDiscounts > 0
                      ? result.revenueLines
                          .filter((line) => line.isContraRevenue)
                          .map((line) => (
                            <tr key={line.accountId} className="border-t">
                              <td className="px-3 py-2 font-mono tabular-nums">
                                <Link
                                  href={`/accounting/ledger?accountId=${line.accountId}&from=${result.from}&to=${result.to}&storeId=${selectedStore}`}
                                  className="text-primary underline-offset-2 hover:underline"
                                >
                                  {line.code}
                                </Link>
                              </td>
                              <td className="px-3 py-2">{line.name}</td>
                              <td className="px-3 py-2 tabular-nums text-destructive">
                                ({formatCurrency(Math.abs(line.amount), currency)})
                              </td>
                            </tr>
                          ))
                      : null}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/20">
                      <td className="px-3 py-2" colSpan={2}>
                        إجمالي الإيراد
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(result.grossRevenue, currency)}
                      </td>
                    </tr>
                    {result.salesDiscounts > 0 ? (
                      <tr className="border-t">
                        <td className="px-3 py-2" colSpan={2}>
                          خصم المبيعات
                        </td>
                        <td className="px-3 py-2 tabular-nums text-destructive">
                          ({formatCurrency(result.salesDiscounts, currency)})
                        </td>
                      </tr>
                    ) : null}
                    <tr className="border-t bg-muted/30 font-medium">
                      <td className="px-3 py-2" colSpan={2}>
                        صافي الإيراد
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(result.netRevenue, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-medium">المصروفات</h3>
              {result.expenseLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">مفيش مصروفات في الفترة.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-start font-medium">الكود</th>
                        <th className="px-3 py-2 text-start font-medium">الحساب</th>
                        <th className="px-3 py-2 text-start font-medium">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.expenseLines.map((line) => (
                        <tr key={line.accountId} className="border-t">
                          <td className="px-3 py-2 font-mono tabular-nums">
                            <Link
                              href={`/accounting/ledger?accountId=${line.accountId}&from=${result.from}&to=${result.to}&storeId=${selectedStore}`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {line.code}
                            </Link>
                          </td>
                          <td className="px-3 py-2">{line.name}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatCurrency(line.amount, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-medium">
                        <td className="px-3 py-2" colSpan={2}>
                          إجمالي المصروفات
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatCurrency(result.totalExpenses, currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <div className="text-sm text-muted-foreground">صافي الربح / الخسارة</div>
              <div
                className={`text-xl font-semibold tabular-nums ${
                  result.netIncome < 0 ? "text-destructive" : ""
                }`}
              >
                {formatCurrency(result.netIncome, currency)}
              </div>
            </div>
          </div>
        )}
      </OperationalCard>
    </>
  );
}
