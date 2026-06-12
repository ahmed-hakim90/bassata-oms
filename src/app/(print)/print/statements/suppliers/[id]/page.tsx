import { notFound } from "next/navigation";
import { requireAuth, getValidatedActiveStoreId } from "@/lib/auth/guards";
import { getSupplierStatement } from "@/modules/suppliers/services/supplier.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { requireSupplierStatementAccess } from "@/modules/reports/actions/report-access.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { StatementTable } from "@/modules/reports/components/statement-table";
import * as orgRepo from "@/lib/repositories/organization.repository";

export default async function PrintSupplierStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; storeId?: string }>;
}) {
  await requireSupplierStatementAccess();
  const user = await requireAuth();
  const { id } = await params;
  const query = await searchParams;
  const storeId = query.storeId ?? (await getValidatedActiveStoreId());
  const statement = await getSupplierStatement(id, { storeId, from: query.from, to: query.to });
  if (!statement) notFound();
  const [org, branding] = await Promise.all([
    orgRepo.getOrganization(),
    getReportBranding(),
  ]);

  return (
    <PrintableDocument
      branding={branding}
      title="Supplier Statement"
      subtitle={statement.supplier.name}
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
          reference: t.reference,
          debit: t.debit,
          credit: t.credit,
          balance: t.balance,
        }))}
      />
    </PrintableDocument>
  );
}
