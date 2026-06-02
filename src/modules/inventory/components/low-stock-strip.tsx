"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import type { InventoryAlert } from "../services/alert.service";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LowStockStripProps {
  alerts: InventoryAlert[];
}

export function LowStockStrip({ alerts }: LowStockStripProps) {
  if (alerts.length === 0) {
    return (
      <GlassPanel className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
        <span className="text-emerald-600">All stocked levels look healthy.</span>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <AlertTriangle className="size-4 text-amber-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Needs attention
        </span>
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-1">
          {alerts.map((alert) => (
            <Link
              key={alert.id}
              href="/products"
              className="min-w-[200px] shrink-0 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 transition hover:border-amber-500/40"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-tight">{alert.title}</p>
                <StatusPill
                  label={alert.type === "out_of_stock" ? "Out" : "Low"}
                  variant={alert.severity === "danger" ? "danger" : "warning"}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </GlassPanel>
  );
}
