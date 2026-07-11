"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ClipboardList, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import type { Product } from "@/lib/types";
import type { StockCountWithLines } from "@/modules/stock-count/services/count.service";
import {
  postCountAction,
  submitCountLinesAction,
} from "@/modules/stock-count/actions/count.actions";

interface StockCountWizardProps {
  count: StockCountWithLines;
  products: Product[];
  onComplete: () => void;
}

export function StockCountWizard({
  count,
  products,
  onComplete,
}: StockCountWizardProps) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"count" | "review">("count");
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(count.lines.map((l) => [l.product_id, l.counted_qty]))
  );

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const filteredLines = count.lines.filter((line) => {
    const name = productMap.get(line.product_id)?.name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const variances = count.lines.map((line) => ({
    ...line,
    counted: counts[line.product_id] ?? line.counted_qty,
    variance: (counts[line.product_id] ?? line.counted_qty) - line.expected_qty,
  }));

  const varianceCount = variances.filter((v) => v.variance !== 0).length;

  const saveCounts = () => {
    startTransition(async () => {
      try {
        await submitCountLinesAction(
          count.id,
          count.lines.map((l) => ({
            productId: l.product_id,
            countedQty: counts[l.product_id] ?? l.counted_qty,
          }))
        );
        setStep("review");
        toast.success("تم حفظ العد");
      } catch {
        toast.error("تعذر الحفظ");
      }
    });
  };

  const postAdjustments = () => {
    startTransition(async () => {
      try {
        await postCountAction(count.id);
        toast.success("تم ترحيل الفروقات");
        onComplete();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر الترحيل");
      }
    });
  };

  if (step === "review") {
    return (
      <OperationalCard title="مراجعة الفروقات" description="أكد قبل الترحيل">
        <div className="mb-4 flex items-center gap-2">
          <StatusPill
            label={`${varianceCount} فروقات`}
            variant={varianceCount > 0 ? "warning" : "success"}
          />
        </div>
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {variances
            .filter((v) => v.variance !== 0)
            .map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-2"
              >
                <span>{productMap.get(v.product_id)?.name}</span>
                <span
                  className={
                    v.variance > 0 ? "text-emerald-600" : "text-red-600"
                  }
                >
                  {v.variance > 0 ? "+" : ""}
                  {v.variance}
                </span>
              </li>
            ))}
          {varianceCount === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              كل الكميات مطابقة للمتوقع
            </p>
          )}
        </ul>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" onClick={() => setStep("count")}>
            رجوع
          </Button>
          <Button onClick={postAdjustments} disabled={pending}>
            <Check className="size-4" /> ترحيل الفروقات
          </Button>
        </div>
      </OperationalCard>
    );
  }

  return (
    <OperationalCard
      title="عدّ الأصناف"
      description={`${count.lines.length} صنف للجرد`}
    >
      <div className="relative mb-4">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن أصناف..."
          className="ps-10"
          aria-label="ابحث عن أصناف"
        />
      </div>
      <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
        {filteredLines.map((line) => (
          <li
            key={line.id}
            className="flex items-center gap-4 rounded-2xl border border-border/50 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {productMap.get(line.product_id)?.name}
              </p>
              <p className="text-xs text-muted-foreground">
                المتوقع: {line.expected_qty}
              </p>
            </div>
            <Input
              type="number"
              min={0}
              className="w-24 text-center"
              aria-label={`الكمية المعدودة لـ ${productMap.get(line.product_id)?.name ?? "صنف"}`}
              value={counts[line.product_id] ?? line.counted_qty}
              onChange={(e) =>
                setCounts({
                  ...counts,
                  [line.product_id]: parseInt(e.target.value) || 0,
                })
              }
            />
          </li>
        ))}
      </ul>
      <Button className="mt-6 w-full" onClick={saveCounts} disabled={pending}>
        <ClipboardList className="size-4" /> مراجعة الفروقات
      </Button>
    </OperationalCard>
  );
}
