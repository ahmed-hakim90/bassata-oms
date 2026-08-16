"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as customerRepo from "@/lib/repositories/customer.repository";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import { getCustomerStatement } from "@/modules/customers/services/customer-account.service";
import { getSupplierStatement } from "@/modules/suppliers/services/supplier.service";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  parseReportFilters,
  resolveReportDateRange,
} from "@/modules/reports/core/report-filters.schema";
import {
  requireCustomerStatementAccess,
  requireReportsView,
  requireSupplierStatementAccess,
} from "@/modules/reports/actions/report-access.actions";
import type { CustomerStatement, SupplierStatement } from "@/lib/types";

export type PartyStatementKind = "customer" | "supplier";

function parsePartyStatementKind(raw?: string | null): PartyStatementKind {
  return raw === "supplier" ? "supplier" : "customer";
}

export interface PartyOption {
  id: string;
  name: string;
  subtitle?: string;
}

export async function getPartyStatementPageData(
  params: Record<string, string | undefined>
) {
  await requireFeature("reports");
  const user = await requireReportsView();
  const filters = parseReportFilters(params);
  const party = parsePartyStatementKind(params.party);
  const activeStoreId = await getValidatedActiveStoreId();
  await requireStoreAccess(activeStoreId);

  const range = resolveReportDateRange(filters);
  const from = filters.from ?? range.from.toISOString().slice(0, 10);
  const to = filters.to ?? range.to.toISOString().slice(0, 10);

  const [org, customers, suppliers] = await Promise.all([
    orgRepo.getOrganization(),
    customerRepo.listCustomers(),
    purchaseRepo.listSuppliers(),
  ]);

  const customerOptions: PartyOption[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: c.phone || undefined,
  }));
  const supplierOptions: PartyOption[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    subtitle: s.contact_info || undefined,
  }));

  const partyId =
    party === "customer"
      ? filters.customerId && customerOptions.some((c) => c.id === filters.customerId)
        ? filters.customerId
        : undefined
      : filters.supplierId && supplierOptions.some((s) => s.id === filters.supplierId)
        ? filters.supplierId
        : undefined;

  let customerStatement: CustomerStatement | null = null;
  let supplierStatement: SupplierStatement | null = null;
  let accessError: string | null = null;

  if (partyId && party === "customer") {
    try {
      await requireCustomerStatementAccess();
      customerStatement = await getCustomerStatement(partyId, { from, to });
    } catch {
      accessError = "مفيش صلاحية لعرض كشف حساب العميل";
    }
  }

  if (partyId && party === "supplier") {
    try {
      await requireSupplierStatementAccess();
      supplierStatement = await getSupplierStatement(partyId, {
        storeId: activeStoreId,
        from,
        to,
      });
    } catch {
      accessError = "مفيش صلاحية لعرض كشف حساب المورد";
    }
  }

  const context = await buildReportContext(
    {
      ...filters,
      from,
      to,
      customerId: party === "customer" ? partyId : undefined,
      supplierId: party === "supplier" ? partyId : undefined,
    },
    user.name,
    activeStoreId
  );

  return {
    filters: {
      ...filters,
      from,
      to,
      customerId: party === "customer" ? partyId : filters.customerId,
      supplierId: party === "supplier" ? partyId : filters.supplierId,
    },
    party,
    partyId,
    storeId: activeStoreId,
    currency: org.currency,
    context,
    customerOptions,
    supplierOptions,
    customerStatement,
    supplierStatement,
    accessError,
  };
}
