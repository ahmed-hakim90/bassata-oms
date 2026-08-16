"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import {
  Building2,
  CircleDollarSign,
  Landmark,
  Scale,
} from "lucide-react";
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
import { exportBalanceSheetExcel } from "@/modules/accounting/actions/gl-export.actions";
import { AccountingStoreSelect } from "@/modules/accounting/components/accounting-store-select";
import { AccountingSubnav } from "@/modules/accounting/components/accounting-subnav";
import type {
  BalanceSheetLine,
  BalanceSheetResult,
} from "@/modules/accounting/services/balance-sheet.service";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";

interface BalanceSheetPageProps {
  result: BalanceSheetResult;
  stores: Store[];
  storeId: string;
  currency: string;
}

function SectionTable({
  title,
  lines,
  totalLabel,
  total,
  currency,
  asOf,
  storeId,
  emptyLabel,
}: {
  title: string;
  lines: BalanceSheetLine[];
  totalLabel: string;
  total: number;
  currency: string;
  asOf: string;
  storeId: string;
  emptyLabel: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ResponsiveListLayout
          mobile={
            <>
              {lines.map((line) => (
                <MobileEntityCard
                  key={line.accountId}
                  href={`/accounting/ledger?accountId=${line.accountId}&from=${asOf.slice(0, 4)}-01-01&to=${asOf}&storeId=${storeId}`}
                  title={line.name}
                  subtitle={`${title} · ${line.code}`}
                  fields={[
                    {
                      label: "الرصيد",
                      value: (
                        <span className="tabular-nums font-medium">
                          {formatCurrency(line.balance, currency)}
                        </span>
                      ),
                    },
                  ]}
                  trailingHint="فتح الدفتر ←"
                />
              ))}
              <MobileEntityCard
                title={totalLabel}
                fields={[
                  {
                    label: "الرصيد",
                    value: (
                      <span className="tabular-nums font-semibold">
                        {formatCurrency(total, currency)}
                      </span>
                    ),
                  },
                ]}
              />
            </>
          }
          desktop={
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">الكود</th>
                    <th className="px-3 py-2 text-start font-medium">الحساب</th>
                    <th className="px-3 py-2 text-start font-medium">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.accountId} className="border-t">
                      <td className="px-3 py-2 font-mono tabular-nums">
                        <Link
                          href={`/accounting/ledger?accountId=${line.accountId}&from=${asOf.slice(0, 4)}-01-01&to=${asOf}&storeId=${storeId}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {line.code}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{line.name}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(line.balance, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-medium">
                    <td className="px-3 py-2" colSpan={2}>
                      {totalLabel}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatCurrency(total, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        />
      )}
    </section>
  );
}

export function BalanceSheetPage({
  result,
  stores,
  storeId,
  currency,
}: BalanceSheetPageProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asOf, setAsOf] = useState(result.asOf);
  const [selectedStore, setSelectedStore] = useState(storeId);

  const applyFilters = () => {
    const params = new URLSearchParams();
    params.set("asOf", asOf);
    params.set("storeId", selectedStore);
    startTransition(() => {
      router.push(`/accounting/balance-sheet?${params.toString()}`);
    });
  };

  const empty =
    result.assets.length === 0 &&
    result.liabilities.length === 0 &&
    result.equity.length === 0 &&
    result.netIncomeYtd === 0;

  return (
    <>
      <PageHeader
        title="الميزانية العمومية"
        description="الأصول والخصوم وحقوق الملكية حتى تاريخ محدد — صافي ربح السنة يظهر ضمن حقوق الملكية"
        action={
          <ExportButtonGroup
            canPrint={false}
            canPdf={false}
            canExcel
            pending={pending}
            onExportExcel={() => {
              startTransition(async () => {
                try {
                  const file = await exportBalanceSheetExcel({
                    asOf,
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

      <div className="mb-3">
        <AccountingSubnav />
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="الأصول"
          value={formatCurrency(result.totalAssets, currency)}
          trend="neutral"
          icon={<Building2 className="size-5" />}
        />
        <KpiCard
          label="الخصوم"
          value={formatCurrency(result.totalLiabilities, currency)}
          trend="neutral"
          icon={<Scale className="size-5" />}
        />
        <KpiCard
          label="حقوق الملكية"
          value={formatCurrency(result.totalEquity, currency)}
          change={`ربح السنة ${formatCurrency(result.netIncomeYtd, currency)}`}
          trend={result.netIncomeYtd >= 0 ? "up" : "down"}
          icon={<Landmark className="size-5" />}
        />
        <KpiCard
          label="التوازن"
          value={result.balanced ? "متوازنة" : "مش متوازنة"}
          change={
            result.balanced
              ? "أصول = خصوم + ملكية"
              : formatCurrency(
                  Math.abs(
                    result.totalAssets - result.totalLiabilitiesAndEquity
                  ),
                  currency
                )
          }
          trend={result.balanced ? "up" : "down"}
          icon={<CircleDollarSign className="size-5" />}
        />
      </div>

      <OperationalCard title="التاريخ">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="bs-asof">حتى تاريخ</Label>
            <Input
              id="bs-asof"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="w-full min-w-0"
            />
          </div>
          <AccountingStoreSelect
            id="bs-store"
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

      <OperationalCard title="الميزانية" description={`حتى ${result.asOf}`}>
        {empty ? (
          <EmptyStateBlock
            title="مفيش أرصدة"
            description="مفيش قيود مرحلة حتى التاريخ ده للفرع المختار."
          />
        ) : (
          <div className="space-y-6">
            <SectionTable
              title="الأصول"
              lines={result.assets}
              totalLabel="إجمالي الأصول"
              total={result.totalAssets}
              currency={currency}
              asOf={result.asOf}
              storeId={selectedStore}
              emptyLabel="مفيش أصول."
            />

            <SectionTable
              title="الخصوم"
              lines={result.liabilities}
              totalLabel="إجمالي الخصوم"
              total={result.totalLiabilities}
              currency={currency}
              asOf={result.asOf}
              storeId={selectedStore}
              emptyLabel="مفيش خصوم."
            />

            <section>
              <h3 className="mb-2 text-sm font-medium">حقوق الملكية</h3>
              <ResponsiveListLayout
                mobile={
                  <>
                    {result.equity.map((line) => (
                      <MobileEntityCard
                        key={line.accountId}
                        href={`/accounting/ledger?accountId=${line.accountId}&from=${result.ytdFrom}&to=${result.asOf}&storeId=${selectedStore}`}
                        title={line.name}
                        subtitle={`حقوق الملكية · ${line.code}`}
                        fields={[
                          {
                            label: "الرصيد",
                            value: (
                              <span className="tabular-nums font-medium">
                                {formatCurrency(line.balance, currency)}
                              </span>
                            ),
                          },
                        ]}
                        trailingHint="فتح الدفتر ←"
                      />
                    ))}
                    <MobileEntityCard
                      title="صافي ربح / خسارة السنة"
                      subtitle={`${result.ytdFrom} → ${result.asOf}`}
                      fields={[
                        {
                          label: "الرصيد",
                          value: (
                            <span
                              className={`tabular-nums font-medium ${
                                result.netIncomeYtd < 0 ? "text-destructive" : ""
                              }`}
                            >
                              {formatCurrency(result.netIncomeYtd, currency)}
                            </span>
                          ),
                        },
                      ]}
                    />
                    <MobileEntityCard
                      title="حقوق الملكية (دفتري)"
                      fields={[
                        {
                          label: "الرصيد",
                          value: (
                            <span className="tabular-nums">
                              {formatCurrency(result.totalEquityBook, currency)}
                            </span>
                          ),
                        },
                      ]}
                    />
                    <MobileEntityCard
                      title="إجمالي حقوق الملكية"
                      fields={[
                        {
                          label: "الرصيد",
                          value: (
                            <span className="tabular-nums font-semibold">
                              {formatCurrency(result.totalEquity, currency)}
                            </span>
                          ),
                        },
                      ]}
                    />
                  </>
                }
                desktop={
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-start font-medium">الكود</th>
                          <th className="px-3 py-2 text-start font-medium">الحساب</th>
                          <th className="px-3 py-2 text-start font-medium">الرصيد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.equity.map((line) => (
                          <tr key={line.accountId} className="border-t">
                            <td className="px-3 py-2 font-mono tabular-nums">
                              <Link
                                href={`/accounting/ledger?accountId=${line.accountId}&from=${result.ytdFrom}&to=${result.asOf}&storeId=${selectedStore}`}
                                className="text-primary underline-offset-2 hover:underline"
                              >
                                {line.code}
                              </Link>
                            </td>
                            <td className="px-3 py-2">{line.name}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {formatCurrency(line.balance, currency)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t">
                          <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">
                            —
                          </td>
                          <td className="px-3 py-2">
                            صافي ربح / خسارة السنة ({result.ytdFrom} → {result.asOf})
                          </td>
                          <td
                            className={`px-3 py-2 tabular-nums ${
                              result.netIncomeYtd < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {formatCurrency(result.netIncomeYtd, currency)}
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/20">
                          <td className="px-3 py-2" colSpan={2}>
                            حقوق الملكية (دفتري)
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatCurrency(result.totalEquityBook, currency)}
                          </td>
                        </tr>
                        <tr className="border-t bg-muted/30 font-medium">
                          <td className="px-3 py-2" colSpan={2}>
                            إجمالي حقوق الملكية
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatCurrency(result.totalEquity, currency)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                }
              />
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/30 px-4 py-3">
                <div className="text-sm text-muted-foreground">إجمالي الأصول</div>
                <div className="text-lg font-semibold tabular-nums">
                  {formatCurrency(result.totalAssets, currency)}
                </div>
              </div>
              <div className="rounded-xl border bg-muted/30 px-4 py-3">
                <div className="text-sm text-muted-foreground">
                  الخصوم + حقوق الملكية
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {formatCurrency(result.totalLiabilitiesAndEquity, currency)}
                </div>
                {!result.balanced ? (
                  <p className="mt-1 text-xs text-destructive">
                    الميزانية مش متوازنة — راجع القيود المرحلة.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                    متوازنة
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </OperationalCard>
    </>
  );
}
