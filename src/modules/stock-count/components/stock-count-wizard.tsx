"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  ClipboardCheck,
  ClipboardList,
  RotateCcw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableShell } from "@/components/SweetFlow/data-table-shell";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { formatUnit } from "@/lib/units";
import type { Product } from "@/lib/types";
import type { StockCountWithLines } from "@/modules/stock-count/services/count.service";
import {
  approveCountAction,
  postCountAction,
  rejectCountApprovalAction,
  submitCountForApprovalAction,
  submitCountLinesAction,
} from "@/modules/stock-count/actions/count.actions";

interface StockCountWizardProps {
  count: StockCountWithLines;
  products: Product[];
  canApprove: boolean;
  trackedProductCount?: number;
  onComplete: () => void;
}

function varianceList(
  count: StockCountWithLines,
  counts: Record<string, number>,
  productMap: Map<string, Product>
) {
  return count.lines.map((line) => ({
    ...line,
    counted: counts[line.product_id] ?? line.counted_qty,
    variance: (counts[line.product_id] ?? line.counted_qty) - line.expected_qty,
    name: productMap.get(line.product_id)?.name,
  }));
}

export function StockCountWizard({
  count,
  products,
  canApprove,
  trackedProductCount = 0,
  onComplete,
}: StockCountWizardProps) {
  const [pending, startTransition] = useTransition();
  const initialStep =
    count.status === "pending_approval" || count.status === "approved"
      ? "review"
      : "count";
  const [step, setStep] = useState<"count" | "review">(initialStep);
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

  const variances = varianceList(count, counts, productMap);
  const varianceCount = variances.filter((v) => v.variance !== 0).length;
  const linesLocked =
    count.status === "pending_approval" || count.status === "approved";

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
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
      }
    });
  };

  const sendForApproval = () => {
    startTransition(async () => {
      try {
        await submitCountLinesAction(
          count.id,
          count.lines.map((l) => ({
            productId: l.product_id,
            countedQty: counts[l.product_id] ?? l.counted_qty,
          }))
        );
        await submitCountForApprovalAction(count.id);
        toast.success("تم إرسال الجرد للاعتماد");
        onComplete();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر الإرسال للاعتماد");
      }
    });
  };

  const approveCount = () => {
    startTransition(async () => {
      try {
        await approveCountAction(count.id);
        toast.success("تم اعتماد الجرد");
        onComplete();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر الاعتماد");
      }
    });
  };

  const rejectApproval = () => {
    startTransition(async () => {
      try {
        await rejectCountApprovalAction(count.id);
        toast.success("تم إرجاع الجرد للعد");
        onComplete();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر الإرجاع");
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

  if (step === "review" || linesLocked) {
    return (
      <OperationalCard
        title="مراجعة الفروقات"
        description={
          count.status === "pending_approval"
            ? "بانتظار اعتماد المدير قبل الترحيل"
            : count.status === "approved"
              ? "معتمد — جاهز لترحيل الفروقات"
              : "أكد العد ثم أرسل للاعتماد قبل الترحيل"
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusPill
            label={`${varianceCount} فروقات`}
            variant={varianceCount > 0 ? "warning" : "success"}
          />
          {count.status === "pending_approval" && (
            <StatusPill label="بانتظار الاعتماد" variant="warning" />
          )}
          {count.status === "approved" && (
            <StatusPill label="معتمد" variant="success" />
          )}
        </div>
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {variances
            .filter((v) => v.variance !== 0)
            .map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-2"
              >
                <span>{v.name}</span>
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
        <div className="mt-6 flex flex-wrap gap-2">
          {count.status === "in_progress" && (
            <>
              <Button variant="outline" onClick={() => setStep("count")} disabled={pending}>
                رجوع
              </Button>
              <Button onClick={sendForApproval} disabled={pending}>
                <Send className="size-4" /> إرسال للاعتماد
              </Button>
            </>
          )}
          {count.status === "pending_approval" && canApprove && (
            <>
              <Button variant="outline" onClick={rejectApproval} disabled={pending}>
                <RotateCcw className="size-4" /> إرجاع للعد
              </Button>
              <Button onClick={approveCount} disabled={pending}>
                <ClipboardCheck className="size-4" /> اعتماد الجرد
              </Button>
            </>
          )}
          {count.status === "pending_approval" && !canApprove && (
            <p className="text-sm text-muted-foreground">
              بانتظار اعتماد المالك أو المدير قبل ترحيل الفروقات.
            </p>
          )}
          {count.status === "approved" && (
            <>
              {canApprove && (
                <Button variant="outline" onClick={rejectApproval} disabled={pending}>
                  <RotateCcw className="size-4" /> إرجاع للعد
                </Button>
              )}
              <Button onClick={postAdjustments} disabled={pending}>
                <Check className="size-4" /> ترحيل الفروقات
              </Button>
            </>
          )}
        </div>
      </OperationalCard>
    );
  }

  const setCountedQty = (productId: string, qty: number) => {
    setCounts((prev) => ({
      ...prev,
      [productId]: Math.max(0, Number.isFinite(qty) ? qty : 0),
    }));
  };

  const zeroAllVisible = () => {
    setCounts((prev) => {
      const next = { ...prev };
      for (const line of filteredLines) {
        next[line.product_id] = 0;
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <DataTableShell
        title={`عدّ الأصناف · ${count.lines.length} صنف`}
        search={search}
        searchPlaceholder="ابحث عن أصناف..."
        onSearchChange={setSearch}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={zeroAllVisible}
            disabled={pending || filteredLines.length === 0}
          >
            تصفير الظاهر
          </Button>
        }
      >
        {filteredLines.length === 0 ? (
          <EmptyStateBlock
            title={
              search.trim()
                ? "لا نتائج للبحث"
                : trackedProductCount === 0
                  ? "لا توجد منتجات بتتبع مخزون"
                  : "لا توجد أصناف في هذا الجرد"
            }
            description={
              search.trim()
                ? "جرّب اسم منتج آخر أو امسح البحث."
                : trackedProductCount === 0
                  ? "من شاشة المنتجات فعّل «تتبع المخزون» للأصناف اللي عايز تجردها، بعدين أعد تحميل الصفحة."
                  : "حدّث الصفحة لإعادة مزامنة الأصناف المتتبَّعة مع الجرد."
            }
          />
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
            <Table className="min-w-[640px]">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
                    المنتج
                  </TableHead>
                  <TableHead className="h-10 text-end text-xs font-semibold text-muted-foreground">
                    الرصيد المتاح
                  </TableHead>
                  <TableHead className="h-10 text-end text-xs font-semibold text-muted-foreground">
                    الحالي
                  </TableHead>
                  <TableHead className="h-10 w-[96px] text-xs font-semibold text-muted-foreground">
                    تصفير
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLines.map((line) => {
                  const product = productMap.get(line.product_id);
                  const name = product?.name ?? "صنف";
                  const unit = product ? formatUnit(product.unit) : "";
                  const counted = counts[line.product_id] ?? line.counted_qty;
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="max-w-[240px] font-medium">
                        <span className="truncate block">{name}</span>
                        {unit ? (
                          <span className="text-xs text-muted-foreground">{unit}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-muted-foreground">
                        {line.expected_qty}
                      </TableCell>
                      <TableCell className="text-end">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          className="ms-auto h-9 w-24 text-center tabular-nums"
                          aria-label={`الرصيد الحالي لـ ${name}`}
                          value={counted}
                          onChange={(e) =>
                            setCountedQty(
                              line.product_id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground"
                          aria-label={`تصفير ${name}`}
                          disabled={pending || counted === 0}
                          onClick={() => setCountedQty(line.product_id, 0)}
                        >
                          تصفير
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DataTableShell>
      <Button className="w-full" onClick={saveCounts} disabled={pending}>
        <ClipboardList className="size-4" /> مراجعة الفروقات
      </Button>
    </div>
  );
}
