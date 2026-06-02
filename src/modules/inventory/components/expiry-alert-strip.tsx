"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatUnit } from "@/lib/units";
import type { ExpiryBatchAlert } from "@/modules/inventory/services/expiry.service";

interface ExpiryAlertStripProps {
  alerts: ExpiryBatchAlert[];
}

function expiryLabel(alert: ExpiryBatchAlert) {
  if (alert.daysUntilExpiry < 0) return `${Math.abs(alert.daysUntilExpiry)}d expired`;
  if (alert.daysUntilExpiry === 0) return "Expires today";
  return `${alert.daysUntilExpiry}d left`;
}

export function ExpiryAlertStrip({ alerts }: ExpiryAlertStripProps) {
  if (alerts.length === 0) {
    return (
      <GlassPanel className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
        <span className="text-emerald-600">No tracked batches are expired or near expiry.</span>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <CalendarClock className="size-4 text-amber-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Expiry attention
        </span>
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-1">
          {alerts.slice(0, 8).map((alert) => (
            <Link
              key={alert.id}
              href="/inventory/waste"
              className="min-w-[220px] shrink-0 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 transition hover:border-amber-500/40"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-tight">{alert.productName}</p>
                <StatusPill
                  label={expiryLabel(alert)}
                  variant={alert.severity === "danger" ? "danger" : "warning"}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Batch {alert.batchNumber} · {alert.remainingQuantity} {formatUnit(alert.unit)} ·{" "}
                {alert.expiryDate}
              </p>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </GlassPanel>
  );
}
