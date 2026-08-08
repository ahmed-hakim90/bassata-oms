"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, BarChart3, Scale, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { KpiCard } from "@/components/Velora/kpi-card";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { OperationalCard } from "@/components/Velora/operational-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import type { Store } from "@/lib/types";
import { exportTrialBalanceExcel } from "@/modules/accounting/actions/gl-export.actions";
import { AccountingStoreSelect } from "@/modules/accounting/components/accounting-store-select";
import { AccountingSubnav } from "@/modules/accounting/components/accounting-subnav";
import type { TrialBalanceResult } from "@/modules/accounting/services/trial-balance.service";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";

const TYPE_LABELS: Record<string, string> = {
  asset: "أصل",
  liability: "خصم",
  equity: "ملكية",
  revenue: "إيراد",
  expense: "مصروف",
};

interface TrialBalancePageProps {
  result: TrialBalanceResult;
  stores: Store[];
  storeId: string;
  currency: string;
}

export function TrialBalancePage({
  result,
  stores,
  storeId,
  currency,
}: TrialBalancePageProps) {
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
      router.push(`/accounting/trial-balance?${params.toString()}`);
    });
  };

  const difference = Math.abs(result.totalDebit - result.totalCredit);
  const balanced = difference < 0.01;
  const activeAccounts = useMemo(
    () => result.lines.filter((line) => line.debit > 0 || line.credit > 0).length,
    [result.lines]
  );

  return (
    <>
      <PageHeader
        title="ميزان المراجعة"
        description="أرصدة الحسابات من القيود المرحلة فقط خلال الفترة — المدين المفروض يساوي الدائن"
        action={
          <ExportButtonGroup
            canPrint={false}
            canPdf={false}
            canExcel
            pending={pending}
            onExportExcel={() => {
              startTransition(async () => {
                try {
                  const file = await exportTrialBalanceExcel({
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
          label="إجمالي المدين"
          value={formatCurrency(result.totalDebit, currency)}
          trend="neutral"
          icon={<WalletCards className="size-5" />}
        />
        <KpiCard
          label="إجمالي الدائن"
          value={formatCurrency(result.totalCredit, currency)}
          trend="neutral"
          icon={<Scale className="size-5" />}
        />
        <KpiCard
          label="حسابات عليها حركة"
          value={String(activeAccounts)}
          change={`من ${result.lines.length} سطر`}
          trend="neutral"
          icon={<BarChart3 className="size-5" />}
        />
        <KpiCard
          label="التوازن"
          value={balanced ? "متوازن" : formatCurrency(difference, currency)}
          change={balanced ? "مدين = دائن" : "فرق يحتاج مراجعة"}
          trend={balanced ? "up" : "down"}
          icon={<AlertTriangle className="size-5" />}
        />
      </div>

      <OperationalCard title="الفترة">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="tb-from">من</Label>
            <Input
              id="tb-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full min-w-0"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="tb-to">إلى</Label>
            <Input
              id="tb-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full min-w-0"
            />
          </div>
          <AccountingStoreSelect
            id="tb-store"
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
        title="الأرصدة"
        description={`${result.from} → ${result.to}`}
      >
        {result.lines.length === 0 ? (
          <EmptyStateBlock
            title="مفيش حركات"
            description="مفيش قيود مرحلة في الفترة دي للفرع المختار."
          />
        ) : (
          <ResponsiveListLayout
            mobile={
              <>
                {result.lines.map((line) => {
                  const ledgerHref = `/accounting/ledger?accountId=${line.accountId}&from=${result.from}&to=${result.to}&storeId=${selectedStore}`;
                  return (
                    <MobileEntityCard
                      key={line.accountId}
                      href={ledgerHref}
                      title={line.code}
                      subtitle={line.name}
                      badge={
                        <span className="text-xs text-muted-foreground">
                          {TYPE_LABELS[line.accountType] ?? line.accountType}
                        </span>
                      }
                      fields={[
                        {
                          label: "مدين",
                          value:
                            line.debit > 0 ? (
                              <span className="tabular-nums">
                                {formatCurrency(line.debit, currency)}
                              </span>
                            ) : (
                              "—"
                            ),
                        },
                        {
                          label: "دائن",
                          value:
                            line.credit > 0 ? (
                              <span className="tabular-nums">
                                {formatCurrency(line.credit, currency)}
                              </span>
                            ) : (
                              "—"
                            ),
                        },
                        {
                          label: "الصافي",
                          value: (
                            <span className="tabular-nums font-medium">
                              {formatCurrency(line.balance, currency)}
                            </span>
                          ),
                        },
                      ]}
                      trailingHint="فتح الدفتر ←"
                    />
                  );
                })}
                <MobileEntityCard
                  title="الإجمالي"
                  fields={[
                    {
                      label: "مدين",
                      value: (
                        <span className="tabular-nums font-medium">
                          {formatCurrency(result.totalDebit, currency)}
                        </span>
                      ),
                    },
                    {
                      label: "دائن",
                      value: (
                        <span className="tabular-nums font-medium">
                          {formatCurrency(result.totalCredit, currency)}
                        </span>
                      ),
                    },
                    {
                      label: "الصافي",
                      value: (
                        <span className="tabular-nums font-medium">
                          {formatCurrency(
                            result.totalDebit - result.totalCredit,
                            currency
                          )}
                        </span>
                      ),
                    },
                  ]}
                />
              </>
            }
            desktop={
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">الكود</th>
                      <th className="px-3 py-2 text-start font-medium">الحساب</th>
                      <th className="px-3 py-2 text-start font-medium">النوع</th>
                      <th className="px-3 py-2 text-start font-medium">مدين</th>
                      <th className="px-3 py-2 text-start font-medium">دائن</th>
                      <th className="px-3 py-2 text-start font-medium">الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lines.map((line) => {
                      const ledgerHref = `/accounting/ledger?accountId=${line.accountId}&from=${result.from}&to=${result.to}&storeId=${selectedStore}`;
                      return (
                        <tr key={line.accountId} className="border-t">
                          <td className="px-3 py-2 font-mono tabular-nums">
                            <Link
                              href={ledgerHref}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {line.code}
                            </Link>
                          </td>
                          <td className="px-3 py-2">
                            <Link
                              href={ledgerHref}
                              className="underline-offset-2 hover:underline"
                            >
                              {line.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {TYPE_LABELS[line.accountType] ?? line.accountType}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {line.debit > 0
                              ? formatCurrency(line.debit, currency)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {line.credit > 0
                              ? formatCurrency(line.credit, currency)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatCurrency(line.balance, currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-medium">
                      <td className="px-3 py-2" colSpan={3}>
                        الإجمالي
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(result.totalDebit, currency)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(result.totalCredit, currency)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(
                          result.totalDebit - result.totalCredit,
                          currency
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }
          />
        )}
      </OperationalCard>
    </>
  );
}
