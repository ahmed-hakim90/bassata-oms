"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark, Plus, ShoppingBag, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { formatCurrency } from "@/lib/format";
import type { CustomerStatement, LoyaltyLedgerEntry } from "@/lib/types";
import type { CustomerProfile } from "@/modules/customers/services/customer.service";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { StatementTable } from "@/modules/reports/components/statement-table";
import { exportCustomerStatementExcel } from "@/modules/reports/actions/statement-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import { CustomerProfileView } from "./customer-profile";
import { CustomerCreditSettingsDialog } from "./customer-credit-settings-dialog";
import { RecordCustomerPaymentDialog } from "./record-customer-payment-dialog";

interface CustomerDetailPageProps {
  profile: CustomerProfile;
  ledger: LoyaltyLedgerEntry[];
  statement: CustomerStatement | null;
  canCollect: boolean;
  canEdit: boolean;
  currency?: string;
}

export function CustomerDetailPage({
  profile,
  ledger,
  statement,
  canCollect,
  canEdit,
  currency = "EGP",
}: CustomerDetailPageProps) {
  const router = useRouter();
  const [showCollect, setShowCollect] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [, startTransition] = useTransition();

  const descriptionParts = [profile.phone, profile.email].filter(Boolean);
  const hasBalance = profile.account_balance > 0;

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]" dir="rtl">
      <PageHeader
        breadcrumb={
          <Link href="/customers" className="text-primary hover:underline">
            العملاء
          </Link>
        }
        title={profile.name}
        description={descriptionParts.join(" · ") || undefined}
        action={
          <div className="flex flex-wrap items-center gap-[var(--mds-space-2)]">
            {canEdit ? (
              <Button variant="outline" onClick={() => setShowCredit(true)}>
                <Wallet className="size-4" /> حد الائتمان
              </Button>
            ) : null}
            {canCollect ? (
              <Button
                onClick={() => setShowCollect(true)}
                disabled={!hasBalance}
                title={hasBalance ? undefined : "مفيش مستحقات على العميل"}
              >
                <Plus className="size-4" /> تحصيل دفعة
              </Button>
            ) : null}
            {statement ? (
              <ExportButtonGroup
                printHref={`/print/statements/customers/${profile.id}`}
                onExportExcel={() => {
                  startTransition(async () => {
                    try {
                      const result = await exportCustomerStatementExcel(profile.id);
                      downloadBase64Excel(result.base64, result.filename);
                      toast.success("تم تصدير Excel");
                    } catch {
                      toast.error("فشل التصدير");
                    }
                  });
                }}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="المستحق"
          value={formatCurrency(profile.account_balance, currency)}
          icon={<Landmark className="size-5" />}
        />
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
          description={`الرصيد الختامي ${formatCurrency(statement.closingBalance, currency)}`}
        >
          <StatementTable
            currency={currency}
            openingBalance={statement.openingBalance}
            closingBalance={statement.closingBalance}
            rows={statement.transactions.map((t) => ({
              id: t.id,
              date: t.at,
              type: t.type,
              reference: t.reference || t.description,
              debit: t.debit,
              credit: t.credit,
              balance: t.balance,
            }))}
          />
        </OperationalCard>
      ) : null}

      <CustomerProfileView profile={profile} ledger={ledger} />

      {canEdit ? (
        <CustomerCreditSettingsDialog
          customerId={profile.id}
          creditLimit={profile.credit_limit}
          paymentTerms={profile.payment_terms}
          open={showCredit}
          onOpenChange={setShowCredit}
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
