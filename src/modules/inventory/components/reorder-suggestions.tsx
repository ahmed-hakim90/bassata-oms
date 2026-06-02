"use client";

import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReorderSuggestion } from "@/modules/inventory/services/reorder.service";

interface ReorderSuggestionsProps {
  suggestions: ReorderSuggestion[];
}

export function ReorderSuggestions({ suggestions }: ReorderSuggestionsProps) {
  if (suggestions.length === 0) {
    return (
      <GlassPanel className="p-5 text-sm text-muted-foreground">
        No reorder suggestions right now.
      </GlassPanel>
    );
  }

  const estimatedTotal = suggestions.reduce((sum, item) => sum + item.estimatedCost, 0);

  return (
    <GlassPanel className="grid gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBasket className="size-4 text-primary" />
            <h2 className="font-semibold">Reorder suggestions</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {suggestions.length} items · estimated {formatCurrency(estimatedTotal)}
          </p>
        </div>
        <Link
          href="/inventory/purchases"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
        >
          Create purchase
        </Link>
      </div>

      <div className="grid gap-2">
        {suggestions.slice(0, 6).map((suggestion) => (
          <div
            key={suggestion.id}
            className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-3 sm:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{suggestion.productName}</p>
                <StatusPill
                  label={suggestion.priority === "urgent" ? "Urgent" : "Soon"}
                  variant={suggestion.priority === "urgent" ? "danger" : "warning"}
                />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {suggestion.warehouseName} · {suggestion.message}
              </p>
              {suggestion.averageDailyUsage > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Recent usage: {suggestion.averageDailyUsage.toFixed(2)} per day
                </p>
              ) : null}
            </div>
            <div className="text-left sm:text-right">
              <p className="font-semibold tabular-nums">
                {suggestion.suggestedQuantity}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(suggestion.estimatedCost)}
              </p>
            </div>
          </div>
        ))}
        {suggestions.length > 6 ? (
          <p className="text-xs text-muted-foreground">
            +{suggestions.length - 6} more suggestions
          </p>
        ) : null}
      </div>
    </GlassPanel>
  );
}
