"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { createPurchaseDraftFromReorderAction } from "@/modules/purchases/actions/purchase.actions";
import type { ReorderSuggestion } from "@/modules/inventory/services/reorder.service";

interface ReorderSuggestionsProps {
  suggestions: ReorderSuggestion[];
}

export function ReorderSuggestions({ suggestions }: ReorderSuggestionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (suggestions.length === 0) {
    return (
      <GlassPanel className="p-5 text-sm text-muted-foreground">
        مفيش اقتراحات شراء دلوقتي — المخزون فوق حد إعادة الطلب.
      </GlassPanel>
    );
  }

  const estimatedTotal = suggestions.reduce((sum, item) => sum + item.estimatedCost, 0);

  function handleCreateDraft() {
    startTransition(async () => {
      const result = await createPurchaseDraftFromReorderAction(
        suggestions.map((item) => ({
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: item.suggestedQuantity,
        }))
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const firstId = result.data.invoiceIds[0];
      if (result.data.count > 1) {
        toast.success(
          `اتعملت ${result.data.count} مسودات شراء (مخزن × مورد حسب آخر شراء). راجع وعدّل قبل الاستلام.`
        );
      } else {
        toast.success("اتعملت مسودة شراء من الاقتراحات — راجع وعدّل قبل الاستلام");
      }

      if (firstId) {
        router.push(`/inventory/purchases?invoice=${firstId}&tab=drafts`);
      } else {
        router.push("/inventory/purchases?tab=drafts");
      }
      router.refresh();
    });
  }

  return (
    <GlassPanel className="grid gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBasket className="size-4 text-primary" />
            <h2 className="font-semibold">اقتراحات إعادة الطلب</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {suggestions.length} صنف · تقديري {formatCurrency(estimatedTotal)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            إنشاء مسودة → راجع الكمية والتكلفة → احفظ واستلم لاحقًا
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="rounded-xl"
          disabled={pending}
          onClick={handleCreateDraft}
        >
          {pending ? "جاري الإنشاء…" : "إنشاء مسودة شراء"}
        </Button>
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
                  label={suggestion.priority === "urgent" ? "عاجل" : "قريب"}
                  variant={suggestion.priority === "urgent" ? "danger" : "warning"}
                />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {suggestion.warehouseName} · اقترح شراء {suggestion.suggestedQuantity}
              </p>
              {suggestion.averageDailyUsage > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  استهلاك تقريبي: {suggestion.averageDailyUsage.toFixed(2)} / يوم
                </p>
              ) : null}
            </div>
            <div className="text-left sm:text-right">
              <p className="font-semibold tabular-nums">{suggestion.suggestedQuantity}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(suggestion.estimatedCost)}
              </p>
            </div>
          </div>
        ))}
        {suggestions.length > 6 ? (
          <p className="text-xs text-muted-foreground">
            +{suggestions.length - 6} أصناف تانية في المسودة
          </p>
        ) : null}
      </div>
    </GlassPanel>
  );
}
