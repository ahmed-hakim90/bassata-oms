import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { getCustomerStatement } from "@/modules/customers/services/customer-account.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { requireCustomerStatementAccess } from "@/modules/reports/actions/report-access.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { StatementTable } from "@/modules/reports/components/statement-table";
import * as orgRepo from "@/lib/repositories/organization.repository";

export default async function PrintCustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireCustomerStatementAccess();
  const user = await requireAuth();
  const { id } = await params;
  const query = await searchParams;
  const statement = await getCustomerStatement(id, query);
  if (!statement) notFound();
  const [org, branding] = await Promise.all([
    orgRepo.getOrganization(),
    getReportBranding(),
  ]);

  return (
    <PrintableDocument
      branding={branding}
      title="Customer Statement"
      subtitle={statement.customerName}
      dateRange={query.from && query.to ? `${query.from} → ${query.to}` : undefined}
      generatedBy={user.name}
      generatedAt={new Date().toISOString()}
    >
      <StatementTable
        currency={org.currency}
        openingBalance={statement.openingBalance}
        closingBalance={statement.closingBalance}
        rows={statement.transactions.map((t) => ({
          id: t.id,
          date: t.at,
          type: t.type,
          reference: t.description,
          debit: t.debit,
          credit: t.credit,
          balance: t.balance,
        }))}
      />
    </PrintableDocument>
  );
}
