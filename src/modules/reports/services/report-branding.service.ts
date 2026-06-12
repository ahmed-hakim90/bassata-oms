import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import {
  buildFilterSummary,
  type ReportBranding,
  type ReportContext,
} from "@/modules/reports/core/report-context";
import type { ReportFilters } from "@/modules/reports/core/report-filters.schema";

export async function getReportBranding(storeId?: string): Promise<ReportBranding> {
  const [org, settings] = await Promise.all([
    orgRepo.getOrganization(),
    orgRepo.listSettings(),
  ]);
  const store = storeId ? await storeRepo.getStore(storeId) : null;
  const receiptHeader = settings.find((s) => s.key === "receipt_header")?.value as
    | { text?: string }
    | undefined;
  const receiptFooter = settings.find((s) => s.key === "receipt_footer")?.value as
    | { text?: string }
    | undefined;

  return {
    orgName: org.name,
    orgLogoUrl: org.logo_url ?? null,
    currency: org.currency,
    storeName: store?.name ?? null,
    storeAddress: store?.address ?? null,
    storePhone: store?.phone ?? null,
    receiptHeader: receiptHeader?.text ?? null,
    receiptFooter: receiptFooter?.text ?? null,
  };
}

export async function buildReportContext(
  filters: ReportFilters,
  generatedBy: string,
  storeId?: string
): Promise<ReportContext> {
  const branding = await getReportBranding(storeId);
  return {
    ...branding,
    generatedBy,
    generatedAt: new Date().toISOString(),
    filters,
    filterSummary: buildFilterSummary(filters),
  };
}
