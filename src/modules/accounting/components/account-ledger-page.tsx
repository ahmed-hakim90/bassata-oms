"use client";

import { useState, useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { ArrowLeftRight, BookOpen, CircleDot } from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { KpiCard } from "@/components/Velora/kpi-card";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { OperationalCard } from "@/components/Velora/operational-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { selectLabelById } from "@/lib/select-label";
import type { GlAccount, Store } from "@/lib/types";
import { exportAccountLedgerExcel } from "@/modules/accounting/actions/gl-export.actions";
import { AccountingStoreSelect } from "@/modules/accounting/components/accounting-store-select";
import { AccountingSubnav } from "@/modules/accounting/components/accounting-subnav";
import type { AccountLedgerResult } from "@/modules/accounting/services/account-ledger.service";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";

const TYPE_LABELS: Record<string, string> = {
  asset: "أصل",
  liability: "خصم",
  equity: "ملكية",
  revenue: "إيراد",
  expense: "مصروف",
};

interface AccountLedgerPageProps {
  result: AccountLedgerResult | null;
  accounts: GlAccount[];
  stores: Store[];
  storeId: string;
  currency: string;
  from: string;
  to: string;
  accountId: string | null;
}

export function AccountLedgerPage({
  result,
  accounts,
  stores,
  storeId,
  currency,
  from: initialFrom,
  to: initialTo,
  accountId: initialAccountId,
}: AccountLedgerPageProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [selectedStore, setSelectedStore] = useState(storeId);
  const [selectedAccount, setSelectedAccount] = useState(initialAccountId ?? "");

  const applyFilters = () => {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    params.set("storeId", selectedStore);
    if (selectedAccount) params.set("accountId", selectedAccount);
    startTransition(() => {
      router.push(`/accounting/ledger?${params.toString()}`);
    });
  };

  return (
    <>
      <PageHeader
        title="دفتر الأستاذ"
        description="حركات حساب واحد مع الرصيد الافتتاحي والجاري من القيود المرحلة — ادخل من ميزان المراجعة أو دليل الحسابات"
        action={
          <ExportButtonGroup
            canPrint={false}
            canPdf={false}
            canExcel={Boolean(result)}
            pending={pending}
            onExportExcel={() => {
              if (!selectedAccount) {
                toast.error("اختَر حسابًا أولًا");
                return;
              }
              startTransition(async () => {
                try {
                  const file = await exportAccountLedgerExcel({
                    accountId: selectedAccount,
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

      <div className="mb-3">
        <AccountingSubnav />
      </div>

      {result ? (
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="رصيد افتتاحي"
            value={formatCurrency(result.openingBalance, currency)}
            trend="neutral"
            icon={<CircleDot className="size-5" />}
          />
          <KpiCard
            label="مدين الفترة"
            value={formatCurrency(result.periodDebit, currency)}
            trend="neutral"
            icon={<ArrowLeftRight className="size-5" />}
          />
          <KpiCard
            label="دائن الفترة"
            value={formatCurrency(result.periodCredit, currency)}
            trend="neutral"
            icon={<ArrowLeftRight className="size-5" />}
          />
          <KpiCard
            label="رصيد ختامي"
            value={formatCurrency(result.closingBalance, currency)}
            change={`${result.movements.length} حركة`}
            trend="neutral"
            icon={<BookOpen className="size-5" />}
          />
        </div>
      ) : null}

      <OperationalCard title="الفلاتر">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto]">
          <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="ledger-account">الحساب</Label>
            <Select
              value={selectedAccount}
              onValueChange={(v) => {
                if (v) setSelectedAccount(v);
              }}
            >
              <SelectTrigger id="ledger-account" className="w-full min-w-0">
                <SelectValue placeholder="اختر حسابًا">
                  {(value) =>
                    selectLabelById(
                      accounts,
                      value,
                      (account) => `${account.code} — ${account.name}`
                    )
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => {
                  const label = `${account.code} — ${account.name}`;
                  return (
                    <SelectItem key={account.id} value={account.id} label={label}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="ledger-from">من</Label>
            <Input
              id="ledger-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full min-w-0"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="ledger-to">إلى</Label>
            <Input
              id="ledger-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full min-w-0"
            />
          </div>
          <AccountingStoreSelect
            id="ledger-store"
            stores={stores}
            value={selectedStore}
            onValueChange={setSelectedStore}
          />
          <div className="flex items-end">
            <Button type="button" disabled={pending || !selectedAccount} onClick={applyFilters}>
              عرض
            </Button>
          </div>
        </div>
      </OperationalCard>

      {!result ? (
        <OperationalCard title="الحركات">
          <EmptyStateBlock
            title="مفيش حسابات"
            description="ازرع دليل الحسابات أو أضف حسابًا قابلًا للترحيل أولًا."
          />
        </OperationalCard>
      ) : (
        <OperationalCard
          title={`${result.account.code} — ${result.account.name}`}
          description={`${TYPE_LABELS[result.account.account_type] ?? result.account.account_type} · ${result.from} → ${result.to}`}
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">رصيد افتتاحي</div>
              <div className="tabular-nums font-medium">
                {formatCurrency(result.openingBalance, currency)}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">حركة الفترة</div>
              <div className="tabular-nums text-sm">
                مدين {formatCurrency(result.periodDebit, currency)} · دائن{" "}
                {formatCurrency(result.periodCredit, currency)}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">رصيد ختامي</div>
              <div className="tabular-nums font-medium">
                {formatCurrency(result.closingBalance, currency)}
              </div>
            </div>
          </div>

          {result.movements.length === 0 ? (
            <EmptyStateBlock
              title="مفيش حركات"
              description="مفيش قيود مرحلة على الحساب ده في الفترة المختارة."
            />
          ) : (
            <ResponsiveListLayout
              mobile={
                <>
                  <MobileEntityCard
                    title="رصيد افتتاحي"
                    fields={[
                      {
                        label: "الرصيد",
                        value: (
                          <span className="tabular-nums font-medium">
                            {formatCurrency(result.openingBalance, currency)}
                          </span>
                        ),
                      },
                    ]}
                  />
                  {result.movements.map((row) => (
                    <MobileEntityCard
                      key={row.lineId}
                      title={row.entryNumber}
                      subtitle={row.entryDate}
                      fields={[
                        { label: "البيان", value: row.memo || "—" },
                        {
                          label: "مدين",
                          value:
                            row.debit > 0 ? (
                              <span className="tabular-nums">
                                {formatCurrency(row.debit, currency)}
                              </span>
                            ) : (
                              "—"
                            ),
                        },
                        {
                          label: "دائن",
                          value:
                            row.credit > 0 ? (
                              <span className="tabular-nums">
                                {formatCurrency(row.credit, currency)}
                              </span>
                            ) : (
                              "—"
                            ),
                        },
                        {
                          label: "الرصيد",
                          value: (
                            <span className="tabular-nums font-medium">
                              {formatCurrency(row.runningBalance, currency)}
                            </span>
                          ),
                        },
                      ]}
                    />
                  ))}
                  <MobileEntityCard
                    title="الإجمالي / الختامي"
                    fields={[
                      {
                        label: "مدين",
                        value: (
                          <span className="tabular-nums">
                            {formatCurrency(result.periodDebit, currency)}
                          </span>
                        ),
                      },
                      {
                        label: "دائن",
                        value: (
                          <span className="tabular-nums">
                            {formatCurrency(result.periodCredit, currency)}
                          </span>
                        ),
                      },
                      {
                        label: "الرصيد",
                        value: (
                          <span className="tabular-nums font-semibold">
                            {formatCurrency(result.closingBalance, currency)}
                          </span>
                        ),
                      },
                    ]}
                  />
                </>
              }
              desktop={
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-start font-medium">التاريخ</th>
                        <th className="px-3 py-2 text-start font-medium">رقم القيد</th>
                        <th className="px-3 py-2 text-start font-medium">البيان</th>
                        <th className="px-3 py-2 text-start font-medium">مدين</th>
                        <th className="px-3 py-2 text-start font-medium">دائن</th>
                        <th className="px-3 py-2 text-start font-medium">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t bg-muted/20">
                        <td className="px-3 py-2" colSpan={5}>
                          رصيد افتتاحي
                        </td>
                        <td className="px-3 py-2 tabular-nums font-medium">
                          {formatCurrency(result.openingBalance, currency)}
                        </td>
                      </tr>
                      {result.movements.map((row) => (
                        <tr key={row.lineId} className="border-t">
                          <td className="px-3 py-2 tabular-nums">{row.entryDate}</td>
                          <td className="px-3 py-2 font-mono tabular-nums">
                            {row.entryNumber}
                          </td>
                          <td className="px-3 py-2">{row.memo || "—"}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {row.debit > 0
                              ? formatCurrency(row.debit, currency)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {row.credit > 0
                              ? formatCurrency(row.credit, currency)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatCurrency(row.runningBalance, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-medium">
                        <td className="px-3 py-2" colSpan={3}>
                          الإجمالي / الختامي
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatCurrency(result.periodDebit, currency)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatCurrency(result.periodCredit, currency)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatCurrency(result.closingBalance, currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              }
            />
          )}
        </OperationalCard>
      )}
    </>
  );
}
