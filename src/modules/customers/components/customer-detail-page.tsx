"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Landmark, MapPin, Plus, ShoppingBag, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { KpiCard } from "@/components/Velora/kpi-card";
import { OperationalCard } from "@/components/Velora/operational-card";
import { formatCurrency } from "@/lib/format";
import type { CustomerStatement, LoyaltyLedgerEntry } from "@/lib/types";
import type { CustomerProfile } from "@/modules/customers/services/customer.service";
import { CUSTOMER_LEDGER_TYPE_LABELS } from "@/modules/customers/lib/ledger-type-labels";
import { getCustomerStatementAction } from "@/modules/customers/actions/customer.actions";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { StatementTable } from "@/modules/reports/components/statement-table";
import { exportCustomerStatementExcel } from "@/modules/reports/actions/statement-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import { CustomerProfileView } from "./customer-profile";
import { CustomerCreditSettingsDialog } from "./customer-credit-settings-dialog";
import { CustomerLegalFieldsDialog } from "./customer-legal-fields-dialog";
import { RecordCustomerPaymentDialog } from "./record-customer-payment-dialog";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function statementRange(from: string, to: string): { from?: string; to?: string } {
  return {
    from: from || undefined,
    to: to || (from ? todayDateString() : undefined),
  };
}

interface CustomerDetailPageProps {
  profile: CustomerProfile;
  ledger: LoyaltyLedgerEntry[];
  statement: CustomerStatement | null;
  canCollect: boolean;
  canEdit: boolean;
  currency?: string;
  /** Soft-hide credit limit controls when org credit_sales is off. */
  creditSalesEnabled?: boolean;
  /** Open collect dialog from aging deep-link `?collect=1`. */
  initialCollectOpen?: boolean;
}

export function CustomerDetailPage({
  profile,
  ledger,
  statement: initialStatement,
  canCollect,
  canEdit,
  currency = "EGP",
  creditSalesEnabled = false,
  initialCollectOpen = false,
}: CustomerDetailPageProps) {
  const router = useRouter();
  const [statement, setStatement] = useState(initialStatement);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showCollect, setShowCollect] = useState(
    Boolean(initialCollectOpen && canCollect && profile.account_balance > 0)
  );
  const [showCredit, setShowCredit] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [pending, startTransition] = useTransition();

  const descriptionParts = [
    profile.phone,
    profile.email,
    profile.tax_id ? `ضريبي ${profile.tax_id}` : null,
  ].filter(Boolean);
  const hasBalance = profile.account_balance > 0;
  const hasDateFilter = Boolean(from || to);

  const refreshStatement = (range?: { from?: string; to?: string }) => {
    startTransition(async () => {
      const result = await getCustomerStatementAction(profile.id, range);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatement(result.data);
    });
  };

  const applyFilter = () => {
    refreshStatement(statementRange(from, to));
  };

  const clearFilter = () => {
    setFrom("");
    setTo("");
    refreshStatement();
  };

  const printQs = new URLSearchParams();
  if (from) printQs.set("from", from);
  if (to) printQs.set("to", to);
  const printHref = `/print/statements/customers/${profile.id}${
    printQs.toString() ? `?${printQs}` : ""
  }`;

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <PageHeader
        breadcrumb={
          <Link href="/customers/directory" className="text-primary hover:underline">
            العملاء
          </Link>
        }
        title={profile.name}
        description={descriptionParts.join(" · ") || undefined}
        action={
          <CompactActions>
            {canCollect && (creditSalesEnabled || hasBalance) ? (
              <CompactAction
                label="تحصيل دفعة"
                icon={Plus}
                variant="default"
                alwaysLabeled
                disabled={!hasBalance}
                onClick={() => setShowCollect(true)}
              />
            ) : null}
            {canEdit ? (
              <CompactAction
                label="بيانات الفاتورة"
                icon={MapPin}
                onClick={() => setShowLegal(true)}
              />
            ) : null}
            {canEdit && creditSalesEnabled ? (
              <CompactAction
                label="حد الائتمان"
                icon={Wallet}
                onClick={() => setShowCredit(true)}
              />
            ) : null}
            {statement ? (
              <ExportButtonGroup
                printHref={printHref}
                onExportExcel={() => {
                  startTransition(async () => {
                    try {
                      const result = await exportCustomerStatementExcel(
                        profile.id,
                        statementRange(from, to)
                      );
                      downloadBase64Excel(result.base64, result.filename);
                      toast.success("تم تصدير Excel");
                    } catch {
                      toast.error("فشل التصدير");
                    }
                  });
                }}
              />
            ) : null}
          </CompactActions>
        }
      />

      <div
        className={
          creditSalesEnabled
            ? "grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4"
            : "grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {creditSalesEnabled || hasBalance ? (
          <KpiCard
            label="المستحق"
            value={formatCurrency(profile.account_balance, currency)}
            icon={<Landmark className="size-5" />}
          />
        ) : null}
        {creditSalesEnabled ? (
          <KpiCard
            label="حد الائتمان"
            value={
              profile.credit_limit > 0
                ? formatCurrency(profile.credit_limit, currency)
                : "بدون حد"
            }
            change={profile.payment_terms || undefined}
            trend="neutral"
            icon={<Wallet className="size-5" />}
          />
        ) : null}
        <KpiCard
          label="إجمالي المشتريات"
          value={formatCurrency(profile.total_spent, currency)}
          change={`متوسط الطلب ${formatCurrency(profile.avgOrderValue, currency)}`}
          trend="neutral"
          icon={<ShoppingBag className="size-5" />}
        />
        <KpiCard
          label="الزيارات"
          value={String(profile.visit_count)}
          change={`${profile.loyaltyBalance} نقطة ولاء`}
          trend="neutral"
          icon={<Users className="size-5" />}
        />
      </div>

      {statement ? (
        <OperationalCard
          title="كشف الحساب"
          description={`الرصيد الختامي ${formatCurrency(statement.closingBalance, currency)}${
            hasDateFilter ? " · فترة مفلترة" : ""
          }`}
        >
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-[var(--mds-radius-md)] border border-border/60 bg-muted/30 p-3 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">من</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-11 w-full bg-background sm:h-9 sm:w-[9.5rem]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">إلى</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-11 w-full bg-background sm:h-9 sm:w-[9.5rem]"
              />
            </div>
            <Button
              size="sm"
              className="col-span-2 min-h-11 sm:col-auto sm:min-h-9"
              onClick={applyFilter}
              disabled={pending}
            >
              تطبيق
            </Button>
            {hasDateFilter ? (
              <Button
                size="sm"
                variant="outline"
                className="col-span-2 min-h-11 sm:col-auto sm:min-h-9"
                onClick={clearFilter}
                disabled={pending}
              >
                مسح
              </Button>
            ) : null}
            {from && !to ? (
              <p className="col-span-2 basis-full text-xs text-muted-foreground">
                تاريخ النهاية يكون اليوم تلقائيًا عند تحديد تاريخ البداية فقط.
              </p>
            ) : null}
          </div>
          <StatementTable
            currency={currency}
            openingBalance={statement.openingBalance}
            closingBalance={statement.closingBalance}
            rows={statement.transactions.map((t) => ({
              id: t.id,
              date: t.at,
              type: CUSTOMER_LEDGER_TYPE_LABELS[t.type] ?? t.type,
              reference: t.reference || t.description,
              debit: t.debit,
              credit: t.credit,
              balance: t.balance,
            }))}
          />
        </OperationalCard>
      ) : null}

      <CustomerProfileView profile={profile} ledger={ledger} />

      {canEdit && creditSalesEnabled ? (
        <CustomerCreditSettingsDialog
          customerId={profile.id}
          creditLimit={profile.credit_limit}
          paymentTerms={profile.payment_terms}
          open={showCredit}
          onOpenChange={setShowCredit}
        />
      ) : null}

      {canEdit ? (
        <CustomerLegalFieldsDialog
          customerId={profile.id}
          address={profile.address}
          taxId={profile.tax_id}
          open={showLegal}
          onOpenChange={setShowLegal}
        />
      ) : null}

      {canCollect ? (
        <RecordCustomerPaymentDialog
          customerId={profile.id}
          accountBalance={profile.account_balance}
          open={showCollect}
          onOpenChange={setShowCollect}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
