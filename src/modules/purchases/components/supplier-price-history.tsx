"use client";

import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { SupplierPriceSummary } from "@/modules/purchases/services/price-history.service";

interface SupplierPriceHistoryProps {
  history: SupplierPriceSummary[];
  currency: string;
}

export function SupplierPriceHistory({ history, currency }: SupplierPriceHistoryProps) {
  if (history.length === 0) return null;

  return (
    <OperationalCard title="Supplier price history" description="Latest received unit costs">
      <div className="grid gap-3">
        {history.slice(0, 6).map((item) => {
          const increased = (item.changePercent ?? 0) > 0;
          const decreased = (item.changePercent ?? 0) < 0;
          return (
            <div
              key={item.productId}
              className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.productName}</p>
                  {item.changePercent !== null ? (
                    <StatusPill
                      label={`${increased ? "+" : ""}${item.changePercent.toFixed(1)}%`}
                      variant={increased ? "danger" : decreased ? "success" : "default"}
                    />
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.supplierName} · {formatDateTime(item.purchasedAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {item.history.slice(0, 3).map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/inventory/purchases?invoice=${entry.invoiceId}`}
                      className="rounded-md border px-2 py-1 hover:border-primary"
                    >
                      {entry.invoiceNumber}: {formatCurrency(entry.unitCost, currency)}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                {increased ? (
                  <TrendingUp className="size-4 text-red-600" />
                ) : decreased ? (
                  <TrendingDown className="size-4 text-emerald-600" />
                ) : null}
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(item.latestUnitCost, currency)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </OperationalCard>
  );
}
