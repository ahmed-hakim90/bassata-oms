"use client";

import { useId, useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
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
import { selectLabelById } from "@/lib/select-label";
import type { Store } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { ReportFilters } from "@/modules/reports/core/report-filters.schema";
import { reportFiltersToSearchParams } from "@/modules/reports/core/report-filters.schema";
import { cn } from "@/lib/utils";

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

const DAY_PRESETS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
] as const;

const fieldLabelClass = "text-xs font-medium text-muted-foreground";
const inputClass = "h-11 w-full min-w-0 rounded-[var(--mds-radius-md)] sm:h-9";
const selectTriggerClass =
  "h-11 w-full min-w-0 rounded-[var(--mds-radius-md)] sm:h-9 data-[size=default]:h-11 sm:data-[size=default]:h-9";

export function ReportFiltersBar({
  basePath,
  filters,
  options = {},
}: ReportFiltersBarProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const id = useId();
  const fromId = `${id}-from`;
  const toId = `${id}-to`;
  const [pending, startTransition] = useTransition();
  const {
    showDateRange = true,
    showStore = true,
    showPaymentMethod = false,
    showDaysPresets = true,
    stores = [],
  } = options;

  const showStoreFilter = showStore && stores.length > 1;
  const customRangeActive = Boolean(filters.from);
  const activePresetDays =
    !customRangeActive && typeof filters.days === "number" ? filters.days : null;

  const apply = (next: Partial<ReportFilters>) => {
    const qs = reportFiltersToSearchParams({ ...filters, ...next, page: 1 });
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath);
    });
  };

  if (!showDaysPresets && !showDateRange && !showStoreFilter && !showPaymentMethod) {
    return null;
  }

  return (
    <div className="min-w-0 rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-3)] shadow-[var(--mds-elevation-1)] sm:p-[var(--mds-space-4)]">
      <div className="flex min-w-0 flex-col gap-[var(--mds-space-4)]">
        {showDaysPresets || showDateRange ? (
          <div className="flex min-w-0 flex-col gap-[var(--mds-space-4)] lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-[var(--mds-space-5)] lg:gap-y-[var(--mds-space-4)]">
            {showDaysPresets ? (
              <div
                role="group"
                aria-label={t("Period")}
                className="min-w-0 shrink-0"
              >
                <p className={cn(fieldLabelClass, "mb-1.5")}>{t("Period")}</p>
                <div className="grid grid-cols-3 gap-[var(--mds-space-2)] sm:inline-flex">
                  {DAY_PRESETS.map((preset) => {
                    const selected = activePresetDays === preset.days;
                    return (
                      <Button
                        key={preset.days}
                        type="button"
                        size="sm"
                        aria-pressed={selected}
                        disabled={pending}
                        className="min-h-11 rounded-[var(--mds-radius-md)] px-3 sm:min-h-9 sm:min-w-[4.75rem]"
                        variant={selected ? "default" : "outline"}
                        onClick={() =>
                          apply({
                            days: preset.days,
                            from: undefined,
                            to: undefined,
                          })
                        }
                      >
                        {t(preset.label)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {showDateRange ? (
              <form
                className="min-w-0 flex-1"
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
                <div className="grid grid-cols-2 items-end gap-[var(--mds-space-3)] md:grid-cols-[minmax(0,14rem)_minmax(0,14rem)_auto]">
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor={fromId} className={fieldLabelClass}>
                      {t("From")}
                    </Label>
                    <Input
                      id={fromId}
                      name="from"
                      type="date"
                      disabled={pending}
                      defaultValue={filters.from ?? ""}
                      className={inputClass}
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor={toId} className={fieldLabelClass}>
                      {t("To")}
                    </Label>
                    <Input
                      id={toId}
                      name="to"
                      type="date"
                      disabled={pending}
                      defaultValue={filters.to ?? ""}
                      className={inputClass}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={pending}
                    className="col-span-2 h-11 w-full rounded-[var(--mds-radius-md)] md:col-auto md:h-9 md:w-auto md:min-w-[5.75rem]"
                  >
                    {t("Apply")}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        ) : null}

        {showStoreFilter || showPaymentMethod ? (
          <div className="grid grid-cols-1 items-end gap-[var(--mds-space-3)] sm:grid-cols-2 lg:max-w-2xl">
            {showStoreFilter ? (
              <div className="min-w-0 space-y-1.5">
                <Label className={fieldLabelClass}>{t("Store")}</Label>
                <Select
                  value={filters.storeId ?? "all"}
                  disabled={pending}
                  onValueChange={(v) =>
                    apply({ storeId: v === "all" ? undefined : v ?? undefined })
                  }
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue>
                      {(value) =>
                        value === "all"
                          ? t("All stores")
                          : selectLabelById(stores, value, (s) => s.name)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" label={t("All stores")}>
                      {t("All stores")}
                    </SelectItem>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id} label={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {showPaymentMethod ? (
              <div className="min-w-0 space-y-1.5">
                <Label className={fieldLabelClass}>{t("Payment method")}</Label>
                <Select
                  value={filters.paymentMethod ?? "all"}
                  disabled={pending}
                  onValueChange={(v) =>
                    apply({
                      paymentMethod:
                        v === "all"
                          ? undefined
                          : (v as ReportFilters["paymentMethod"]),
                    })
                  }
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue>
                      {(value) =>
                        value === "all" ? t("All") : value ? t(String(value)) : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" label={t("All")}>
                      {t("All")}
                    </SelectItem>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m} label={t(m)}>
                        {t(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
