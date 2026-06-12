import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";

export const reportFiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  days: z.coerce.number().int().positive().optional(),
  storeId: z.string().optional(),
  categoryId: z.string().optional(),
  productId: z.string().optional(),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export function parseReportFilters(
  params: Record<string, string | string[] | undefined>
): ReportFilters {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    raw[key] = Array.isArray(value) ? value[0] : value;
  }
  return reportFiltersSchema.parse(raw);
}

export function reportFiltersToSearchParams(filters: Partial<ReportFilters>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "page" && value === 1) continue;
    if (key === "pageSize" && value === 50) continue;
    sp.set(key, String(value));
  }
  return sp.toString();
}

export function resolveReportDateRange(filters: ReportFilters): {
  from: Date;
  to: Date;
  days: number;
} {
  const to = filters.to ? new Date(`${filters.to}T23:59:59`) : new Date();
  if (filters.from) {
    const from = new Date(filters.from);
    const days = Math.max(
      1,
      Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
    );
    return { from, to, days };
  }
  const days = filters.days ?? 30;
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from, to, days };
}

export function resolveReportStoreId(
  activeStoreId: string,
  filterStoreId?: string | null
): string | undefined {
  if (!filterStoreId || filterStoreId === "all") return undefined;
  return filterStoreId;
}
