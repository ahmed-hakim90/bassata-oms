"use server";

import { requireAuth } from "@/lib/auth/guards";
import { getCustomerStatement } from "@/modules/customers/services/customer-account.service";
import { getSupplierStatement } from "@/modules/suppliers/services/supplier.service";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  requireCustomerStatementAccess,
  requireReportExcelAccess,
  requireSupplierStatementAccess,
} from "@/modules/reports/actions/report-access.actions";
import { buildReportWorkbook, workbookToBase64 } from "@/modules/reports/export/excel-builder";
import { parseReportFilters } from "@/modules/reports/core/report-filters.schema";
import * as orgRepo from "@/lib/repositories/organization.repository";

export async function exportCustomerStatementExcel(
  customerId: string,
  range?: { from?: string; to?: string }
) {
  await requireReportExcelAccess();
  await requireCustomerStatementAccess();
  const user = await requireAuth();
  const statement = await getCustomerStatement(customerId, range);
  if (!statement) throw new Error("Customer not found");
  const org = await orgRepo.getOrganization();
  const filters = parseReportFilters({
    from: range?.from,
    to: range?.to,
    page: "1",
    pageSize: "50",
  });
  const context = await buildReportContext(filters, user.name);

  const workbook = buildReportWorkbook({
    title: "Customer Statement",
    context,
    fileName: `customer-statement-${statement.customerName.replace(/\s+/g, "-").toLowerCase()}`,
    sheets: [
      {
        name: "Statement",
        columns: [
          { header: "Date", accessor: (r) => r.date },
          { header: "Type", accessor: (r) => r.type },
          { header: "Description", accessor: (r) => r.description },
          { header: "Debit", accessor: (r) => r.debit },
          { header: "Credit", accessor: (r) => r.credit },
          { header: "Balance", accessor: (r) => r.balance },
        ],
        rows: [
          {
            date: "",
            type: "Opening",
            description: "",
            debit: statement.openingBalance,
            credit: 0,
            balance: statement.openingBalance,
          },
          ...statement.transactions.map((t) => ({
            date: t.at,
            type: t.type,
            description: t.description,
            debit: t.debit,
            credit: t.credit,
            balance: t.balance,
          })),
        ] as Record<string, unknown>[],
      },
    ],
  });

  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-customer-${statement.customerName.replace(/\s+/g, "-").toLowerCase()}.xlsx`,
    currency: org.currency,
    statement,
  };
}

export async function exportSupplierStatementExcel(
  supplierId: string,
  storeId: string,
  range?: { from?: string; to?: string }
) {
  await requireReportExcelAccess();
  await requireSupplierStatementAccess();
  const user = await requireAuth();
  const statement = await getSupplierStatement(supplierId, { storeId, ...range });
  if (!statement) throw new Error("Supplier not found");
  const org = await orgRepo.getOrganization();
  const filters = parseReportFilters({
    from: range?.from,
    to: range?.to,
    page: "1",
    pageSize: "50",
  });
  const context = await buildReportContext(filters, user.name);

  const workbook = buildReportWorkbook({
    title: "Supplier Statement",
    context,
    fileName: `supplier-statement-${statement.supplier.name.replace(/\s+/g, "-").toLowerCase()}`,
    sheets: [
      {
        name: "Statement",
        columns: [
          { header: "Date", accessor: (r) => r.date },
          { header: "Type", accessor: (r) => r.type },
          { header: "Reference", accessor: (r) => r.reference ?? "" },
          { header: "Debit", accessor: (r) => r.debit },
          { header: "Credit", accessor: (r) => r.credit },
          { header: "Balance", accessor: (r) => r.balance },
        ],
        rows: [
          {
            date: "",
            type: "Opening",
            reference: "",
            debit: statement.openingBalance,
            credit: 0,
            balance: statement.openingBalance,
          },
          ...statement.transactions.map((t) => ({
            date: t.at,
            type: t.type,
            reference: t.reference,
            debit: t.debit,
            credit: t.credit,
            balance: t.balance,
          })),
        ] as Record<string, unknown>[],
      },
    ],
  });

  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-supplier-${statement.supplier.name.replace(/\s+/g, "-").toLowerCase()}.xlsx`,
    currency: org.currency,
    statement,
  };
}
