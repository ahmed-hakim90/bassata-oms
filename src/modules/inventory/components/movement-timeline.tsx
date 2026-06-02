"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import type { MovementTimelineItem } from "../services/movement.service";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  sale: "Sale",
  purchase: "Purchase",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  waste: "Waste",
  adjustment: "Adjustment",
  stock_count: "Stock count",
};

interface MovementTimelineProps {
  movements: MovementTimelineItem[];
  compact?: boolean;
}

export function MovementTimeline({ movements, compact }: MovementTimelineProps) {
  if (movements.length === 0) {
    return (
      <GlassPanel className="p-8 text-center text-sm text-muted-foreground">
        No inventory movements yet. Adjust stock or receive purchases to populate the timeline.
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className={cn("p-4", compact && "max-h-[420px] overflow-y-auto")}>
      <ul className="relative space-y-0">
        {movements.map((movement, index) => {
          const positive = movement.quantity_delta > 0;
          const neutral = movement.quantity_delta === 0;
          return (
            <li key={movement.id} className="relative flex gap-4 pb-6 last:pb-0">
              {index < movements.length - 1 ? (
                <span
                  className="absolute left-[15px] top-8 bottom-0 w-px bg-border"
                  aria-hidden
                />
              ) : null}
              <div
                className={cn(
                  "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background",
                  positive && "border-emerald-500/40 text-emerald-600",
                  !positive && !neutral && "border-red-500/40 text-red-600",
                  neutral && "text-muted-foreground"
                )}
              >
                {neutral ? (
                  <Minus className="size-4" />
                ) : positive ? (
                  <ArrowUp className="size-4" />
                ) : (
                  <ArrowDown className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{movement.productName}</p>
                  <StatusPill
                    label={typeLabels[movement.movement_type] ?? movement.movement_type}
                    variant="default"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {movement.warehouseName} · {movement.reason ?? "No reason provided"} ·{" "}
                  {formatDistanceToNow(new Date(movement.created_at), { addSuffix: true })}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm font-semibold tabular-nums",
                    positive && "text-emerald-700 dark:text-emerald-300",
                    !positive && !neutral && "text-red-700 dark:text-red-300"
                  )}
                >
                  {positive ? "+" : ""}
                  {movement.quantity_delta} units
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
