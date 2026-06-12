import type { ReportFilters } from "@/modules/reports/core/report-filters.schema";

export interface ReportBranding {
  orgName: string;
  orgLogoUrl: string | null;
  currency: string;
  storeName: string | null;
  storeAddress: string | null;
  storePhone: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
}

export interface ReportContext extends ReportBranding {
  generatedBy: string;
  generatedAt: string;
  filters: ReportFilters;
  filterSummary: string;
}

export function buildFilterSummary(filters: ReportFilters): string {
  const parts: string[] = [];
  if (filters.from && filters.to) {
    parts.push(`${filters.from} → ${filters.to}`);
  } else if (filters.days) {
    parts.push(`Last ${filters.days} days`);
  }
  if (filters.storeId && filters.storeId !== "all") {
    parts.push(`Store: ${filters.storeId}`);
  }
  if (filters.categoryId) parts.push(`Category: ${filters.categoryId}`);
  if (filters.productId) parts.push(`Product: ${filters.productId}`);
  if (filters.customerId) parts.push(`Customer: ${filters.customerId}`);
  if (filters.supplierId) parts.push(`Supplier: ${filters.supplierId}`);
  if (filters.paymentMethod) parts.push(`Payment: ${filters.paymentMethod}`);
  return parts.length > 0 ? parts.join(" · ") : "All data";
}
