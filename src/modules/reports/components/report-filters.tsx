"use client";

import { useRouter } from "next/navigation";
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
import { PAYMENT_METHODS } from "@/lib/constants";
import type { Store } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { ReportFilters } from "@/modules/reports/core/report-filters.schema";
import { reportFiltersToSearchParams } from "@/modules/reports/core/report-filters.schema";

export interface ReportFilterOptions {
  showDateRange?: boolean;
  showStore?: boolean;
  showPaymentMethod?: boolean;
  showDaysPresets?: boolean;
  stores?: Store[];
}

interface ReportFiltersBarProps {
  basePath: string;
  filters: Partial<ReportFilters>;
  options?: ReportFilterOptions;
}

export function ReportFiltersBar({
  basePath,
  filters,
  options = {},
}: ReportFiltersBarProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    showDateRange = true,
    showStore = true,
    showPaymentMethod = false,
    showDaysPresets = true,
    stores = [],
  } = options;

  const apply = (next: Partial<ReportFilters>) => {
    const qs = reportFiltersToSearchParams({ ...filters, ...next, page: 1 });
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  return (
    <div className="flex flex-wrap items-end gap-[var(--mds-space-3)] rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)]">
      {showDaysPresets ? (
        <div className="flex gap-[var(--mds-space-2)]">
          {[7, 30, 90].map((days) => (
            <Button
              key={days}
              type="button"
              size="sm"
              className="rounded-[var(--mds-radius-md)]"
              variant={filters.days === days && !filters.from ? "default" : "outline"}
              onClick={() => apply({ days, from: undefined, to: undefined })}
            >
              {days}d
            </Button>
          ))}
        </div>
      ) : null}

      {showDateRange ? (
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
            <Label htmlFor="from">{t("From")}</Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={filters.from ?? ""}
              className="rounded-[var(--mds-radius-md)]"
            />
          </div>
          <div className="space-y-[var(--mds-space-1)]">
            <Label htmlFor="to">{t("To")}</Label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={filters.to ?? ""}
              className="rounded-[var(--mds-radius-md)]"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            className="rounded-[var(--mds-radius-md)] shadow-[var(--mds-elevation-1)]"
          >
            {t("Apply")}
          </Button>
        </form>
      ) : null}

      {showStore && stores.length > 0 ? (
        <div className="space-y-[var(--mds-space-1)]">
          <Label>{t("Store")}</Label>
          <Select
            value={filters.storeId ?? "all"}
            onValueChange={(v) => apply({ storeId: v === "all" ? undefined : v ?? undefined })}
          >
            <SelectTrigger className="w-[180px] rounded-[var(--mds-radius-md)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All stores")}</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {showPaymentMethod ? (
        <div className="space-y-[var(--mds-space-1)]">
          <Label>{t("Payment method")}</Label>
          <Select
            value={filters.paymentMethod ?? "all"}
            onValueChange={(v) =>
              apply({ paymentMethod: v === "all" ? undefined : (v as ReportFilters["paymentMethod"]) })
            }
          >
            <SelectTrigger className="w-[160px] rounded-[var(--mds-radius-md)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All")}</SelectItem>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
