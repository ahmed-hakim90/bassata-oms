"use client";

import { useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { BookOpen, Landmark, Users } from "lucide-react";
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
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { formatCurrency } from "@/lib/format";
import { selectLabelById } from "@/lib/select-label";
import type { CustomerStatement, SupplierStatement, SupplierStatementTransactionType } from "@/lib/types";
import { customerLedgerDisplayLabel } from "@/modules/customers/lib/ledger-type-labels";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportPage } from "@/modules/reports/components/report-page";
import { StatementTable } from "@/modules/reports/components/statement-table";
import {
  exportCustomerStatementExcel,
  exportSupplierStatementExcel,
} from "@/modules/reports/actions/statement-report.actions";
import type {
  PartyOption,
  PartyStatementKind,
} from "@/modules/reports/actions/party-statement-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import { cn } from "@/lib/utils";

const SUPPLIER_TYPE_LABELS: Record<SupplierStatementTransactionType, string> = {
  purchase: "شراء",
  purchase_void: "إلغاء فاتورة",
  purchase_return: "مرتجع شراء",
  payment: "دفعة",
  payment_void: "إلغاء دفعة",
};

interface PartyStatementReportViewProps {
  filters: ReportFilters;
  party: PartyStatementKind;
  partyId?: string;
  storeId: string;
  currency: string;
  context: ReportContext;
  customerOptions: PartyOption[];
  supplierOptions: PartyOption[];
  customerStatement: CustomerStatement | null;
  supplierStatement: SupplierStatement | null;
  accessError: string | null;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function PartyStatementReportView({
  filters,
  party,
  partyId,
  storeId,
  currency,
  customerOptions,
  supplierOptions,
  customerStatement,
  supplierStatement,
  accessError,
  canPrint,
  canExcel,
  canPdf,
}: PartyStatementReportViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const apply = (next: Partial<ReportFilters> & { party?: PartyStatementKind }) => {
    const nextParty = next.party ?? party;
    const merged: Record<string, string | number | undefined> = {
      ...filters,
      ...next,
      page: 1,
    };
    delete merged.party;
    if (nextParty === "customer") {
      delete merged.supplierId;
    } else {
      delete merged.customerId;
    }
    const qs = reportFiltersToSearchParams(merged);
    const parts = [qs, `party=${nextParty}`].filter(Boolean);
    router.push(`/reports/statement?${parts.join("&")}`);
  };

  const statement = party === "customer" ? customerStatement : supplierStatement;
  const partyName =
    party === "customer"
      ? customerStatement?.customerName
      : supplierStatement?.supplier.name;

  const printQs = new URLSearchParams();
  if (filters.from) printQs.set("from", filters.from);
  if (filters.to) printQs.set("to", filters.to);
  if (party === "supplier") printQs.set("storeId", storeId);
  const printHref =
    partyId && statement
      ? party === "customer"
        ? `/print/statements/customers/${partyId}${printQs.toString() ? `?${printQs}` : ""}`
        : `/print/statements/suppliers/${partyId}${printQs.toString() ? `?${printQs}` : ""}`
      : undefined;

  const options = party === "customer" ? customerOptions : supplierOptions;

  return (
    <ReportPage
      title="كشف حساب عميل / مورد"
      description="اختار الطرف والفترة عشان تشوف الحركات والرصيد الجاري"
      actions={
        statement && partyId ? (
          <ExportButtonGroup
            printHref={canPrint ? printHref : undefined}
            canPrint={canPrint}
            canExcel={canExcel}
            canPdf={canPdf}
            pending={pending}
            onExportExcel={() => {
              startTransition(async () => {
                try {
                  const range = {
                    from: filters.from || undefined,
                    to: filters.to || undefined,
                  };
                  const result =
                    party === "customer"
                      ? await exportCustomerStatementExcel(partyId, range)
                      : await exportSupplierStatementExcel(partyId, storeId, range);
                  downloadBase64Excel(result.base64, result.filename);
                  toast.success("تم تصدير Excel");
                } catch {
                  toast.error("فشل التصدير");
                }
              });
            }}
          />
        ) : undefined
      }
      filters={
        <div className="flex flex-col gap-[var(--mds-space-3)]">
          <div className="flex flex-wrap gap-[var(--mds-space-2)]">
            {(
              [
                { value: "customer" as const, label: "عميل", icon: Users },
                { value: "supplier" as const, label: "مورد", icon: Landmark },
              ] as const
            ).map((tab) => (
              <Button
                key={tab.value}
                type="button"
                size="sm"
                variant={party === tab.value ? "default" : "outline"}
                className={cn("min-h-10 rounded-[var(--mds-radius-md)] gap-2")}
                onClick={() =>
                  apply({
                    party: tab.value,
                    customerId: undefined,
                    supplierId: undefined,
                  })
                }
              >
                <tab.icon className="size-4" />
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-[var(--mds-space-3)]">
            <div className="min-w-[14rem] flex-1 space-y-[var(--mds-space-1)]">
              <Label>{party === "customer" ? "العميل" : "المورد"}</Label>
              <Select
                value={partyId ?? "__unset"}
                onValueChange={(v) => {
                  const id = !v || v === "__unset" ? undefined : v;
                  apply(
                    party === "customer"
                      ? { customerId: id, supplierId: undefined }
                      : { supplierId: id, customerId: undefined }
                  );
                }}
              >
                <SelectTrigger className="w-full rounded-[var(--mds-radius-md)]">
                  <SelectValue
                    placeholder={
                      party === "customer" ? "اختر عميل…" : "اختر مورد…"
                    }
                  >
                    {(value) =>
                      selectLabelById(options, value, (p) =>
                        p.subtitle ? `${p.name} · ${p.subtitle}` : p.name
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unset" label={party === "customer" ? "اختر عميل…" : "اختر مورد…"}>
                    {party === "customer" ? "اختر عميل…" : "اختر مورد…"}
                  </SelectItem>
                  {options.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      label={p.subtitle ? `${p.name} · ${p.subtitle}` : p.name}
                    >
                      {p.subtitle ? `${p.name} · ${p.subtitle}` : p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <form
              className="flex flex-wrap items-end gap-[var(--mds-space-2)]"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                apply({
                  from: fd.get("from")?.toString() || undefined,
                  to: fd.get("to")?.toString() || undefined,
                  days: undefined,
                });
              }}
            >
              <div className="space-y-[var(--mds-space-1)]">
                <Label htmlFor="stmt-from">من</Label>
                <Input
                  id="stmt-from"
                  name="from"
                  type="date"
                  defaultValue={filters.from ?? ""}
                  className="rounded-[var(--mds-radius-md)]"
                />
              </div>
              <div className="space-y-[var(--mds-space-1)]">
                <Label htmlFor="stmt-to">إلى</Label>
                <Input
                  id="stmt-to"
                  name="to"
                  type="date"
                  defaultValue={filters.to ?? ""}
                  className="rounded-[var(--mds-radius-md)]"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                تطبيق الفترة
              </Button>
            </form>
          </div>
        </div>
      }
    >
      {accessError ? (
        <p className="rounded-[var(--mds-radius-md)] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {accessError}
        </p>
      ) : null}

      {!partyId ? (
        <EmptyStateBlock
          title="اختار الطرف"
          description={
            party === "customer"
              ? "اختار عميل عشان يظهر كشف الحساب المفصل"
              : "اختار مورد عشان يظهر كشف الحساب المفصل"
          }
        />
      ) : null}

      {partyId && statement && !accessError ? (
        <>
          <ReportKpiGrid
            items={[
              {
                label: "رصيد افتتاحي",
                value: formatCurrency(statement.openingBalance, currency),
                icon: <BookOpen className="size-5" />,
              },
              {
                label: "رصيد ختامي",
                value: formatCurrency(statement.closingBalance, currency),
                icon:
                  party === "customer" ? (
                    <Users className="size-5" />
                  ) : (
                    <Landmark className="size-5" />
                  ),
              },
              {
                label: "عدد الحركات",
                value: String(
                  party === "customer"
                    ? customerStatement!.transactions.length
                    : supplierStatement!.transactions.length
                ),
              },
              {
                label: party === "customer" ? "العميل" : "المورد",
                value: partyName ?? "—",
              },
            ]}
          />

          <StatementTable
            currency={currency}
            openingBalance={statement.openingBalance}
            closingBalance={statement.closingBalance}
            rows={
              party === "customer"
                ? customerStatement!.transactions.map((t) => ({
                    id: t.id,
                    date: t.at,
                    type: customerLedgerDisplayLabel({
                      type: t.type,
                      paymentId: t.paymentId,
                      debit: t.debit,
                    }),
                    reference: t.reference || t.description,
                    debit: t.debit,
                    credit: t.credit,
                    balance: t.balance,
                  }))
                : supplierStatement!.transactions.map((t) => ({
                    id: t.id,
                    date: t.at,
                    type: SUPPLIER_TYPE_LABELS[t.type] ?? t.type,
                    reference: t.reference || t.description,
                    debit: t.debit,
                    credit: t.credit,
                    balance: t.balance,
                  }))
            }
          />
        </>
      ) : null}

      {partyId && !statement && !accessError ? (
        <EmptyStateBlock
          title="مفيش كشف"
          description="مش لاقي بيانات للطرف المختار"
        />
      ) : null}
    </ReportPage>
  );
}
