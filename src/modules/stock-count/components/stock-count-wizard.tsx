"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Barcode,
  Check,
  ClipboardCheck,
  ClipboardList,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { DataTableShell } from "@/components/Velora/data-table-shell";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { formatUnit } from "@/lib/units";
import { selectLabelById } from "@/lib/select-label";
import { cn } from "@/lib/utils";
import type { Category, Product } from "@/lib/types";
import type { StockCountWithLines } from "@/modules/stock-count/services/count.service";
import {
  approveCountAction,
  postCountAction,
  rejectCountApprovalAction,
  submitCountForApprovalAction,
  submitCountLinesAction,
} from "@/modules/stock-count/actions/count.actions";
import {
  findProductByCode,
  productMatchesQuery,
} from "@/modules/products/lib/match-products";
import { clampCountedQty, nextCountedQty } from "@/modules/stock-count/lib/counted-qty";
import { playPosErrorSound, playPosSuccessSound } from "@/modules/pos/lib/pos-sounds";

interface StockCountWizardProps {
  count: StockCountWithLines;
  products: Product[];
  categories: Category[];
  canApprove: boolean;
  trackedProductCount?: number;
  barcodeScannerEnabled?: boolean;
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
  categories,
  canApprove,
  trackedProductCount = 0,
  barcodeScannerEnabled = true,
  onComplete,
}: StockCountWizardProps) {
  const [pending, startTransition] = useTransition();
  const initialStep =
    count.status === "pending_approval" || count.status === "approved"
      ? "review"
      : "count";
  const [step, setStep] = useState<"count" | "review">(initialStep);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [scanCode, setScanCode] = useState("");
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(count.lines.map((l) => [l.product_id, l.counted_qty]))
  );
  const scanRef = useRef<HTMLInputElement>(null);
  const countsRef = useRef(counts);
  const savedRef = useRef(counts);
  const skipSaveRef = useRef(true);
  countsRef.current = counts;

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );
  const lineProductIds = useMemo(
    () => new Set(count.lines.map((l) => l.product_id)),
    [count.lines]
  );

  const filteredLines = count.lines.filter((line) => {
    const product = productMap.get(line.product_id);
    if (categoryId !== "all" && product?.category_id !== categoryId) return false;
    if (!product) return search.trim() === "";
    return productMatchesQuery(product, search);
  });

  const variances = varianceList(count, counts, productMap);
  const varianceCount = variances.filter((v) => v.variance !== 0).length;
  const scannedUnits = count.lines.reduce(
    (sum, line) => sum + (counts[line.product_id] ?? line.counted_qty),
    0
  );
  const touchedCount = count.lines.filter((line) => {
    const counted = counts[line.product_id] ?? line.counted_qty;
    return counted !== line.expected_qty;
  }).length;
  const linesLocked =
    count.status === "pending_approval" || count.status === "approved";

  const persistLines = useCallback(
    async (nextCounts: Record<string, number>) => {
      const lines = count.lines
        .map((l) => ({
          productId: l.product_id,
          countedQty: clampCountedQty(nextCounts[l.product_id] ?? l.counted_qty),
        }))
        .filter((line) => line.countedQty !== (savedRef.current[line.productId] ?? 0));
      if (lines.length === 0) {
        setSaveState("saved");
        return;
      }
      setSaveState("saving");
      try {
        await submitCountLinesAction(count.id, lines);
        savedRef.current = { ...nextCounts };
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        throw e;
      }
    },
    [count.id, count.lines]
  );

  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (linesLocked) return;
    const timer = window.setTimeout(() => {
      void persistLines(countsRef.current).catch(() => {
        toast.error("تعذر حفظ العد تلقائياً");
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [counts, linesLocked, persistLines]);

  const setCountedQty = useCallback((productId: string, qty: number) => {
    setCounts((prev) => ({
      ...prev,
      [productId]: clampCountedQty(qty),
    }));
  }, []);

  const applyScan = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const product = findProductByCode(products, code);
      if (!product) {
        playPosErrorSound();
        toast.error("باركود غير معروف");
        return;
      }
      if (!lineProductIds.has(product.id)) {
        playPosErrorSound();
        toast.error(
          product.track_inventory
            ? "الصنف مش في الجرد ده"
            : "الصنف من غير تتبع مخزون — فعّل التتبع من المنتجات"
        );
        return;
      }
      setCounts((prev) => ({
        ...prev,
        [product.id]: nextCountedQty(prev[product.id] ?? 0, 1),
      }));
      const nextQty = nextCountedQty(countsRef.current[product.id] ?? 0, 1);
      playPosSuccessSound();
      toast.success(`${product.name} → ${nextQty}`);
      setLastScannedId(product.id);
      setScanCode("");
      window.requestAnimationFrame(() => {
        document
          .querySelector(`[data-count-product="${product.id}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        scanRef.current?.focus();
      });
    },
    [lineProductIds, products]
  );

  useEffect(() => {
    if (!barcodeScannerEnabled || linesLocked || step !== "count") return;
    let buffer = "";
    let lastAt = 0;
    const gapMs = 45;
    const minLen = 4;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target === scanRef.current) return;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || Boolean(target?.isContentEditable)) {
        return;
      }
      const now = Date.now();
      const isBurst = now - lastAt <= gapMs;
      lastAt = now;
      if (!isBurst) buffer = "";

      if (event.key === "Enter") {
        if (buffer.length >= minLen) {
          event.preventDefault();
          applyScan(buffer);
          buffer = "";
        }
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        buffer += event.key;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyScan, barcodeScannerEnabled, linesLocked, step]);

  const saveCounts = (thenReview: boolean) => {
    startTransition(async () => {
      try {
        await persistLines(countsRef.current);
        if (thenReview) setStep("review");
        toast.success("تم حفظ العد");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
      }
    });
  };

  const sendForApproval = () => {
    startTransition(async () => {
      try {
        await persistLines(countsRef.current);
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

  const openPrint = () => {
    startTransition(async () => {
      try {
        if (!linesLocked) await persistLines(countsRef.current);
        window.open(
          `/print/stock-count/${count.id}`,
          "_blank",
          "noopener,noreferrer"
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "احفظ العد قبل الطباعة");
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
        <div className="mt-6">
          <CompactActions className="justify-start">
          <CompactAction
            label="طباعة"
            icon={Printer}
            disabled={pending}
            onClick={openPrint}
          />
          {count.status === "in_progress" ? (
            <>
              <CompactAction
                label="رجوع"
                icon={ArrowLeft}
                disabled={pending}
                onClick={() => setStep("count")}
              />
              <CompactAction
                label="إرسال للاعتماد"
                icon={Send}
                variant="default"
                disabled={pending}
                onClick={sendForApproval}
              />
            </>
          ) : null}
          {count.status === "pending_approval" && canApprove ? (
            <>
              <CompactAction
                label="إرجاع للعد"
                icon={RotateCcw}
                disabled={pending}
                onClick={rejectApproval}
              />
              <CompactAction
                label="اعتماد الجرد"
                icon={ClipboardCheck}
                variant="default"
                disabled={pending}
                onClick={approveCount}
              />
            </>
          ) : null}
          {count.status === "pending_approval" && !canApprove ? (
            <p className="text-sm text-muted-foreground">
              بانتظار اعتماد المالك أو المدير قبل ترحيل الفروقات.
            </p>
          ) : null}
          {count.status === "approved" ? (
            <>
              {canApprove ? (
                <CompactAction
                  label="إرجاع للعد"
                  icon={RotateCcw}
                  disabled={pending}
                  onClick={rejectApproval}
                />
              ) : null}
              <CompactAction
                label="ترحيل الفروقات"
                icon={Check}
                variant="default"
                disabled={pending}
                onClick={postAdjustments}
              />
            </>
          ) : null}
          </CompactActions>
        </div>
      </OperationalCard>
    );
  }

  const zeroAllVisible = () => {
    setCounts((prev) => {
      const next = { ...prev };
      for (const line of filteredLines) {
        next[line.product_id] = 0;
      }
      return next;
    });
    scanRef.current?.focus();
  };

  const lastScanned = lastScannedId ? productMap.get(lastScannedId) : null;
  const saveLabel =
    saveState === "saving"
      ? "جاري الحفظ…"
      : saveState === "saved"
        ? "محفوظ"
        : saveState === "error"
          ? "فشل الحفظ"
          : `${touchedCount} فرق · ${scannedUnits} وحدة`;

  return (
    <div className="space-y-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      {barcodeScannerEnabled ? (
        <OperationalCard
          title="عدّ بالسكانر"
          description="امسح الباركود — كل مسحة بتزود 1. صفّر الأول لو هتعدّ من الصفر."
        >
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              applyScan(scanCode);
            }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="stock-count-scan">باركود الصنف</Label>
              <Input
                ref={scanRef}
                id="stock-count-scan"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                autoComplete="off"
                autoFocus
                placeholder="امسح هنا — الجهاز بيعدّ لوحده"
                aria-label="مسح باركود الجرد"
                className="h-12 font-mono text-base"
              />
            </div>
            <Button type="submit" className="h-12 shrink-0 sm:w-auto">
              <Barcode className="size-4" />
              عدّ +1
            </Button>
          </form>
          {lastScanned ? (
            <p className="mt-3 text-sm">
              آخر مسح:{" "}
              <span className="font-medium">{lastScanned.name}</span>
              <span className="ms-2 tabular-nums text-muted-foreground">
                → {counts[lastScanned.id] ?? 0}
              </span>
            </p>
          ) : null}
        </OperationalCard>
      ) : null}

      <DataTableShell
        title={`عدّ الأصناف · ${count.lines.length} صنف`}
        search={search}
        searchPlaceholder="ابحث بالاسم أو الباركود أو الـ SKU…"
        onSearchChange={setSearch}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? "all")}>
              <SelectTrigger className="h-11 w-[min(100%,12rem)] sm:h-9" aria-label="قسم المنتجات">
                <SelectValue placeholder="كل الأقسام">
                  {(value) =>
                    value === "all"
                      ? "كل الأقسام"
                      : selectLabelById(categories, value, (c) => c.name)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="كل الأقسام">
                  كل الأقسام
                </SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id} label={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={zeroAllVisible}
              disabled={pending || filteredLines.length === 0}
            >
              صفّر الظاهر وعدّ
            </Button>
          </div>
        }
      >
        {filteredLines.length === 0 ? (
          <EmptyStateBlock
            title={
              search.trim() || categoryId !== "all"
                ? "لا نتائج للبحث"
                : trackedProductCount === 0
                  ? "لا توجد منتجات بتتبع مخزون"
                  : "لا توجد أصناف في هذا الجرد"
            }
            description={
              search.trim() || categoryId !== "all"
                ? "جرّب اسم أو باركود تاني، أو غيّر القسم."
                : trackedProductCount === 0
                  ? "من شاشة المنتجات فعّل «تتبع المخزون» للأصناف اللي عايز تجردها، بعدين أعد تحميل الصفحة."
                  : "حدّث الصفحة لإعادة مزامنة الأصناف المتتبَّعة مع الجرد."
            }
          />
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
            <ResponsiveListLayout
              mobile={filteredLines.map((line) => {
                const product = productMap.get(line.product_id);
                const name = product?.name ?? "صنف";
                const unit = product ? formatUnit(product.unit) : "";
                const counted = counts[line.product_id] ?? line.counted_qty;
                const variance = counted - line.expected_qty;
                return (
                  <div key={line.id} data-count-product={line.product_id}>
                    <MobileEntityCard
                      title={name}
                      subtitle={[unit, product?.barcode || product?.sku]
                        .filter(Boolean)
                        .join(" · ") || undefined}
                      className={cn(
                        lastScannedId === line.product_id && "ring-2 ring-primary"
                      )}
                      fields={[
                        {
                          label: "المتوقع",
                          value: (
                            <span className="tabular-nums">{line.expected_qty}</span>
                          ),
                        },
                        {
                          label: "الفرق",
                          value: (
                            <span
                              className={
                                variance === 0
                                  ? "tabular-nums text-muted-foreground"
                                  : variance > 0
                                    ? "tabular-nums text-emerald-600"
                                    : "tabular-nums text-red-600"
                              }
                            >
                              {variance > 0 ? "+" : ""}
                              {variance}
                            </span>
                          ),
                        },
                      ]}
                      footer={
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="size-11 shrink-0"
                            aria-label={`نقص ${name}`}
                            disabled={pending || counted <= 0}
                            onClick={() =>
                              setCountedQty(line.product_id, nextCountedQty(counted, -1))
                            }
                          >
                            <Minus className="size-4" />
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            className="h-11 flex-1 text-center tabular-nums"
                            aria-label={`الرصيد الحالي لـ ${name}`}
                            value={counted}
                            onChange={(e) =>
                              setCountedQty(
                                line.product_id,
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="size-11 shrink-0"
                            aria-label={`زيادة ${name}`}
                            disabled={pending}
                            onClick={() =>
                              setCountedQty(line.product_id, nextCountedQty(counted, 1))
                            }
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      }
                    />
                  </div>
                );
              })}
              desktop={
                <div className="overflow-x-auto">
                  <Table className="min-w-[720px]">
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLines.map((line) => {
                        const product = productMap.get(line.product_id);
                        const name = product?.name ?? "صنف";
                        const unit = product ? formatUnit(product.unit) : "";
                        const counted = counts[line.product_id] ?? line.counted_qty;
                        const highlighted = lastScannedId === line.product_id;
                        return (
                          <TableRow
                            key={line.id}
                            data-count-product={line.product_id}
                            className={cn(highlighted && "bg-primary/5")}
                          >
                            <TableCell className="max-w-[280px] font-medium">
                              <span className="truncate block">{name}</span>
                              <span className="text-xs text-muted-foreground">
                                {[unit, product?.barcode || product?.sku]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </TableCell>
                            <TableCell className="text-end tabular-nums text-muted-foreground">
                              {line.expected_qty}
                            </TableCell>
                            <TableCell className="text-end">
                              <div className="ms-auto flex w-[168px] items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="size-9 shrink-0"
                                  aria-label={`نقص ${name}`}
                                  disabled={pending || counted <= 0}
                                  onClick={() =>
                                    setCountedQty(
                                      line.product_id,
                                      nextCountedQty(counted, -1)
                                    )
                                  }
                                >
                                  <Minus className="size-4" />
                                </Button>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  inputMode="decimal"
                                  className="h-9 w-20 text-center tabular-nums"
                                  aria-label={`الرصيد الحالي لـ ${name}`}
                                  value={counted}
                                  onChange={(e) =>
                                    setCountedQty(
                                      line.product_id,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="size-9 shrink-0"
                                  aria-label={`زيادة ${name}`}
                                  disabled={pending}
                                  onClick={() =>
                                    setCountedQty(
                                      line.product_id,
                                      nextCountedQty(counted, 1)
                                    )
                                  }
                                >
                                  <Plus className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              }
            />
          </div>
        )}
      </DataTableShell>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur-xl md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pt-3 lg:ps-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-muted-foreground">{saveLabel}</p>
          <CompactActions>
            <CompactAction
              label="طباعة"
              icon={Printer}
              disabled={pending}
              onClick={openPrint}
            />
            <CompactAction
              label="مراجعة الفروقات"
              icon={ClipboardList}
              variant="default"
              disabled={pending}
              alwaysLabeled
              onClick={() => saveCounts(true)}
            />
          </CompactActions>
        </div>
      </div>
    </div>
  );
}
