"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Barcode, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { LoadingStateBlock } from "@/components/SweetFlow/state-blocks";
import { formatCurrency } from "@/lib/format";
import { sanitizeDecimalInput } from "@/lib/digits";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n/use-translation";
import { calculateExpiryDate } from "@/lib/inventory/expiry";
import { selectLabelById } from "@/lib/select-label";
import {
  convertPurchaseEntryToBase,
  formatUnit,
  productHasPurchasePacking,
  productPurchaseFactor,
} from "@/lib/units";
import type {
  MeasurementUnit,
  PaymentMethod,
  Product,
  PurchaseInvoiceLine,
  Supplier,
  Warehouse,
} from "@/lib/types";
import {
  addPurchaseLineAction,
  createPurchaseAction,
  deleteDraftPurchaseAction,
  getPurchaseDetailAction,
  receivePurchaseAction,
  removePurchaseLineAction,
  updateDraftPurchaseAction,
  updatePurchaseLineAction,
  voidPurchaseAction,
} from "@/modules/purchases/actions/purchase.actions";
import type { PurchaseWithLines } from "@/modules/purchases/services/purchase.service";

function withLineTotals(
  lines: PurchaseInvoiceLine[],
  extraCost: number
): Pick<PurchaseWithLines, "lines" | "subtotal" | "extra_cost" | "total"> {
  const subtotal = Number(lines.reduce((s, l) => s + l.line_total, 0).toFixed(2));
  const extra = Math.max(0, extraCost);
  return {
    lines,
    subtotal,
    extra_cost: extra,
    total: Number((subtotal + extra).toFixed(2)),
  };
}

/** Controlled draft field — avoids Base UI warning when line.qty/cost updates after blur. */
function DraftDecimalInput({
  value,
  emptyFallback,
  className,
  onCommit,
}: {
  value: number;
  emptyFallback: number;
  className?: string;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      value={draft}
      onChange={(e) => setDraft(sanitizeDecimalInput(e.target.value))}
      onBlur={() => {
        const raw = sanitizeDecimalInput(draft);
        const next = parseFloat(raw) || emptyFallback;
        setDraft(String(next));
        if (next !== value) onCommit(next);
      }}
    />
  );
}

interface PurchaseFormProps {
  suppliers: Supplier[];
  products: Product[];
  warehouses: Warehouse[];
  currency: string;
  initialInvoiceId?: string;
  onComplete: () => void;
}

export function PurchaseForm({
  suppliers,
  products,
  warehouses,
  currency,
  initialInvoiceId,
  onComplete,
}: PurchaseFormProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(!!initialInvoiceId);
  const [invoice, setInvoice] = useState<PurchaseWithLines | null>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ""
  );
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [extraCost, setExtraCost] = useState("");
  const [barcode, setBarcode] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [entryUnit, setEntryUnit] = useState<MeasurementUnit>("piece");
  const [batchNumber, setBatchNumber] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [confirmReceive, setConfirmReceive] = useState(false);
  const [receivePending, setReceivePending] = useState(false);
  const [amountPaidNow, setAmountPaidNow] = useState("0");
  const [receivePaymentMethod, setReceivePaymentMethod] =
    useState<PaymentMethod>("cash");
  const [showLineDetails, setShowLineDetails] = useState(false);
  const [showHeader, setShowHeader] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const snapshotRef = useRef<PurchaseWithLines | null>(null);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const productLabel = (p: Product) => `${p.name} · ${formatUnit(p.unit)}`;

  const selectProduct = useCallback((product: Product) => {
    setSelectedProductId(product.id);
    setUnitCost("");
    const base = product.base_unit ?? product.unit;
    setEntryUnit(productHasPurchasePacking(product) ? product.cost_unit : base);
    setBarcode(product.name);
    setSearchOpen(false);
    setHighlightIndex(0);
    setTimeout(() => {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }, 50);
  }, []);

  const searchMatches = useMemo(() => {
    const q = barcode.trim().toLowerCase();
    if (q.length < 1) return [];
    const exact = products.find(
      (p) => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q
    );
    if (exact) return [exact];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode?.toLowerCase().includes(q) ?? false) ||
          (p.sku?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 8);
  }, [barcode, products]);

  const selectedProduct = selectedProductId ? productMap.get(selectedProductId) : undefined;
  const selectedHasPacking = selectedProduct ? productHasPurchasePacking(selectedProduct) : false;
  const selectedBaseUnit = selectedProduct
    ? (selectedProduct.base_unit ?? selectedProduct.unit)
    : "piece";
  const selectedPurchaseUnit = selectedProduct?.cost_unit ?? selectedBaseUnit;
  const selectedFactor = selectedProduct ? productPurchaseFactor(selectedProduct) : 1;
  const parsedQuantity = parseFloat(quantity);
  const parsedUnitCost = parseFloat(unitCost);
  const entryPreview =
    selectedProduct && selectedHasPacking && parsedQuantity > 0
      ? convertPurchaseEntryToBase({
          quantity: parsedQuantity,
          unitCost:
            Number.isFinite(parsedUnitCost) && parsedUnitCost >= 0
              ? parsedUnitCost
              : selectedProduct.last_unit_cost || 0,
          entryUnit,
          baseUnit: selectedBaseUnit,
          purchaseUnit: selectedPurchaseUnit,
          unitsPerPurchaseUnit: selectedFactor,
        })
      : null;
  const calculatedExpiryDate = calculateExpiryDate(
    productionDate || null,
    selectedProduct?.shelf_life_value ?? 0,
    selectedProduct?.shelf_life_unit ?? "days"
  );

  const resetLineInputs = () => {
    setBarcode("");
    setQuantity("");
    setUnitCost("");
    setEntryUnit("piece");
    setBatchNumber("");
    setProductionDate("");
    setExpiryDate("");
    setSelectedProductId("");
    setSearchOpen(false);
    setHighlightIndex(0);
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (!initialInvoiceId) return;
    startTransition(async () => {
      const result = await getPurchaseDetailAction(initialInvoiceId);
      setLoading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInvoice(result.data);
      setSupplierId(result.data.supplier_id);
      setWarehouseId(result.data.warehouse_id);
      setInvoiceNumber(result.data.invoice_number);
      setExtraCost(
        result.data.extra_cost > 0 ? String(result.data.extra_cost) : ""
      );
    });
  }, [initialInvoiceId]);

  const handleCreateDraft = () => {
    if (!supplierId || !warehouseId || !invoiceNumber.trim()) {
      toast.error("اختار المورد والمخزن واكتب رقم الفاتورة");
      return;
    }
    startTransition(async () => {
      const result = await createPurchaseAction({
        supplierId,
        warehouseId,
        invoiceNumber: invoiceNumber.trim(),
        extraCost: parseFloat(extraCost) || 0,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const created = result.data;
      const supplier = suppliers.find((s) => s.id === supplierId);
      setInvoice({
        ...created,
        lines: [],
        supplierName: supplier?.name ?? "",
        warehouseName: warehouses.find((w) => w.id === warehouseId)?.name ?? "",
      });
      toast.success("مسودة محفوظة — أضف الأصناف");
      setTimeout(() => barcodeRef.current?.focus(), 100);
    });
  };

  const addLine = useCallback(
    (
      productId: string,
      qty: number,
      cost: number,
      lineEntryUnit: MeasurementUnit,
      lineBatchNumber?: string | null,
      lineProductionDate?: string | null,
      lineExpiryDate?: string | null
    ) => {
      if (!invoice || qty <= 0 || cost < 0) return;
      const product = productMap.get(productId);
      if (!product) return;

      const baseUnit = product.base_unit ?? product.unit;
      const purchaseUnit = product.cost_unit ?? baseUnit;
      const factor = productPurchaseFactor(product);
      const converted = convertPurchaseEntryToBase({
        quantity: qty,
        unitCost: cost,
        entryUnit: lineEntryUnit,
        baseUnit,
        purchaseUnit,
        unitsPerPurchaseUnit: factor,
      });

      snapshotRef.current = invoice;
      const existing = invoice.lines.find(
        (l) => l.product_id === productId && l.variant_id == null
      );

      let nextLines: PurchaseInvoiceLine[];
      let optimisticId: string;

      if (existing) {
        const mergedQty = existing.quantity + converted.quantity;
        const blendedCost =
          mergedQty > 0
            ? Number(
                (
                  (existing.quantity * existing.unit_cost +
                    converted.quantity * converted.unitCost) /
                  mergedQty
                ).toFixed(4)
              )
            : converted.unitCost;
        optimisticId = existing.id;
        nextLines = invoice.lines.map((l) =>
          l.id === existing.id
            ? {
                ...l,
                quantity: mergedQty,
                unit_cost: blendedCost,
                line_total: Number((mergedQty * blendedCost).toFixed(2)),
                batch_number: lineBatchNumber ?? null,
                production_date: lineProductionDate ?? null,
                expiry_date: lineExpiryDate ?? null,
              }
            : l
        );
      } else {
        optimisticId = `temp-${crypto.randomUUID()}`;
        nextLines = [
          ...invoice.lines,
          {
            id: optimisticId,
            invoice_id: invoice.id,
            product_id: productId,
            variant_id: null,
            quantity: converted.quantity,
            unit_cost: converted.unitCost,
            line_total: converted.lineTotal,
            landed_unit_cost: null,
            landed_line_total: null,
            batch_number: lineBatchNumber ?? null,
            production_date: lineProductionDate ?? null,
            expiry_date: lineExpiryDate ?? null,
          },
        ];
      }

      setInvoice({
        ...invoice,
        ...withLineTotals(nextLines, invoice.extra_cost),
      });
      resetLineInputs();
      toast.success(`تمت إضافة ${product.name}`);

      void (async () => {
        const result = await addPurchaseLineAction({
          invoiceId: invoice.id,
          productId,
          quantity: qty,
          unitCost: cost,
          entryUnit: lineEntryUnit,
          batchNumber: lineBatchNumber ?? null,
          productionDate: lineProductionDate ?? null,
          expiryDate: lineExpiryDate ?? null,
        });
        if (!result.ok) {
          if (snapshotRef.current) setInvoice(snapshotRef.current);
          toast.error(result.error);
          return;
        }
        setInvoice((prev) => {
          if (!prev) return prev;
          const others = prev.lines.filter(
            (l) =>
              !(
                l.product_id === result.data.product_id &&
                (l.variant_id ?? null) === (result.data.variant_id ?? null)
              )
          );
          return {
            ...prev,
            ...withLineTotals([...others, result.data], prev.extra_cost),
          };
        });
      })();
    },
    [invoice, productMap]
  );

  const lookupBarcode = (code: string) =>
    products.find((p) => p.barcode === code.trim() || p.sku === code.trim());

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = lookupBarcode(barcode);

    if (searchOpen && searchMatches.length > 0 && !found) {
      const pick = searchMatches[Math.min(highlightIndex, searchMatches.length - 1)];
      if (pick) {
        selectProduct(pick);
        return;
      }
    }

    if (found && (!selectedProductId || selectedProductId !== found.id)) {
      selectProduct(found);
      return;
    }

    if (!selectedProductId && searchMatches.length === 1) {
      selectProduct(searchMatches[0]!);
      return;
    }

    if (!selectedProductId && searchMatches.length > 1) {
      setSearchOpen(true);
      toast.info("اختار المنتج من القائمة");
      return;
    }

    const productId = selectedProductId || found?.id;
    if (!productId) {
      toast.error("المنتج غير موجود");
      return;
    }
    const product = productMap.get(productId);
    if (!product) {
      toast.error("المنتج غير موجود");
      return;
    }
    addLine(
      productId,
      Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1,
      Number.isFinite(parsedUnitCost) && parsedUnitCost >= 0
        ? parsedUnitCost
        : product.last_unit_cost || 0,
      entryUnit,
      batchNumber || null,
      productionDate || null,
      expiryDate || calculatedExpiryDate || null
    );
  };

  const handleReceive = async () => {
    if (!invoice) return;
    const paid = parseFloat(amountPaidNow) || 0;
    if (paid < 0) {
      toast.error("مبلغ الدفعة لازم يكون صفر أو أكبر");
      return;
    }
    if (paid > invoice.total) {
      toast.error("مبلغ الدفعة لا يمكن أن يتجاوز إجمالي الفاتورة");
      return;
    }
    setReceivePending(true);
    try {
      const result = await receivePurchaseAction(invoice.id, {
        amountPaid: paid,
        paymentMethod: paid > 0 ? receivePaymentMethod : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const remaining = Number((invoice.total - paid).toFixed(2));
      toast.success(
        paid > 0
          ? `تم الاستلام — دُفع ${formatCurrency(paid, currency)}، الباقي ${formatCurrency(remaining, currency)}`
          : "تم الحفظ النهائي — تم تحديث المخزون"
      );
      setConfirmReceive(false);
      onComplete();
    } finally {
      setReceivePending(false);
    }
  };

  const receiveRemaining = invoice
    ? Number((invoice.total - (parseFloat(amountPaidNow) || 0)).toFixed(2))
    : 0;

  const saveHeader = () => {
    if (!invoice || invoice.status !== "draft") return;
    startTransition(async () => {
      const result = await updateDraftPurchaseAction({
        invoiceId: invoice.id,
        supplierId,
        invoiceNumber: invoiceNumber.trim(),
        extraCost: parseFloat(extraCost) || 0,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const supplier = suppliers.find((s) => s.id === supplierId);
      const nextExtra = parseFloat(extraCost) || 0;
      setInvoice({
        ...invoice,
        ...result.data,
        ...withLineTotals(invoice.lines, nextExtra),
        supplierName: supplier?.name ?? invoice.supplierName,
      });
      toast.success("تم الحفظ المؤقت");
    });
  };

  const updateLine = (
    lineId: string,
    qty: number,
    cost: number,
    nextBatchNumber?: string | null,
    nextProductionDate?: string | null,
    nextExpiryDate?: string | null
  ) => {
    if (!invoice || qty <= 0 || cost < 0) return;
    if (lineId.startsWith("temp-")) return;

    snapshotRef.current = invoice;
    const nextLines = invoice.lines.map((l) =>
      l.id === lineId
        ? {
            ...l,
            quantity: qty,
            unit_cost: cost,
            line_total: Number((qty * cost).toFixed(2)),
            batch_number: nextBatchNumber ?? null,
            production_date: nextProductionDate ?? null,
            expiry_date: nextExpiryDate ?? null,
          }
        : l
    );
    setInvoice({ ...invoice, ...withLineTotals(nextLines, invoice.extra_cost) });

    void (async () => {
      const result = await updatePurchaseLineAction({
        lineId,
        quantity: qty,
        unitCost: cost,
        batchNumber: nextBatchNumber ?? null,
        productionDate: nextProductionDate ?? null,
        expiryDate: nextExpiryDate ?? null,
      });
      if (!result.ok) {
        if (snapshotRef.current) setInvoice(snapshotRef.current);
        toast.error(result.error);
        return;
      }
      setInvoice((prev) => {
        if (!prev) return prev;
        const lines = prev.lines.map((l) => (l.id === lineId ? result.data : l));
        return { ...prev, ...withLineTotals(lines, prev.extra_cost) };
      });
    })();
  };

  const removeLine = (lineId: string) => {
    if (!invoice) return;
    snapshotRef.current = invoice;
    const nextLines = invoice.lines.filter((l) => l.id !== lineId);
    setInvoice({ ...invoice, ...withLineTotals(nextLines, invoice.extra_cost) });

    if (lineId.startsWith("temp-")) return;

    void (async () => {
      const result = await removePurchaseLineAction(lineId);
      if (!result.ok) {
        if (snapshotRef.current) setInvoice(snapshotRef.current);
        toast.error(result.error);
      }
    })();
  };

  const handleDeleteDraft = async () => {
    if (!invoice) return;
    const result = await deleteDraftPurchaseAction(invoice.id);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success("تم حذف فاتورة الشراء");
    onComplete();
  };

  const handleVoid = async () => {
    if (!invoice) return;
    const result = await voidPurchaseAction(invoice.id);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    setInvoice(result.data);
    setSupplierId(result.data.supplier_id);
    setWarehouseId(result.data.warehouse_id);
    setInvoiceNumber(result.data.invoice_number);
    setExtraCost(
      result.data.extra_cost > 0 ? String(result.data.extra_cost) : ""
    );
    toast.success("تم إلغاء الاستلام — رجعت مسودة. الأصناف اللي مكانش ليها رصيد تقدر تعدّلها وتستلم تاني");
  };

  if (loading) {
    return <LoadingStateBlock label="جاري تحميل فاتورة الشراء…" />;
  }

  const subtotal = invoice?.lines.reduce((s, l) => s + l.line_total, 0) ?? 0;
  const isDraft = invoice?.status === "draft";
  const isReceived = invoice?.status === "received";
  const statusLabels: Record<string, string> = {
    draft: "مسودة",
    received: "مستلمة",
    cancelled: "ملغاة",
  };

  if (!invoice) {
    return (
      <OperationalCard title="فاتورة شراء جديدة">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>المورد</Label>
            <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="اختار المورد">
                  {(value) => selectLabelById(suppliers, value, (s) => s.name)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id} label={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>المخزن</Label>
            <Select value={warehouseId} onValueChange={(v) => setWarehouseId(v ?? "")}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="اختار المخزن">
                  {(value) => selectLabelById(warehouses, value, (w) => w.name)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id} label={w.name}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>رقم الفاتورة</Label>
            <Input
              className="min-h-11"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-001"
              onKeyDown={(e) => e.key === "Enter" && handleCreateDraft()}
            />
          </div>
          <div className="space-y-2">
            <Label>تكلفة إضافية (اختياري)</Label>
            <Input
              className="min-h-11"
              type="text"
              inputMode="decimal"
              value={extraCost}
              onChange={(e) => setExtraCost(sanitizeDecimalInput(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          بعد البدء تُحفظ كمسودة — أكمل الأصناف الآن أو لاحقًا.
        </p>
        <Button
          className="mt-4 min-h-12 w-full text-base"
          onClick={handleCreateDraft}
          disabled={pending}
        >
          ابدأ الفاتورة
        </Button>
      </OperationalCard>
    );
  }

  const renderLineEditor = (line: PurchaseInvoiceLine) => {
    const lineProduct = productMap.get(line.product_id);
    const unit = lineProduct ? formatUnit(lineProduct.base_unit ?? lineProduct.unit) : "";
    const packHint =
      lineProduct && productHasPurchasePacking(lineProduct)
        ? ` · ${productPurchaseFactor(lineProduct)}/${formatUnit(lineProduct.cost_unit)}`
        : "";

    return (
      <div
        key={line.id}
        className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium leading-snug">{lineProduct?.name ?? line.product_id}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {unit}
              {packHint}
            </p>
          </div>
          {isDraft ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 text-destructive"
              onClick={() => removeLine(line.id)}
              aria-label="حذف البند"
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">الكمية</Label>
            {isDraft ? (
              <DraftDecimalInput
                className="min-h-11"
                value={line.quantity}
                emptyFallback={1}
                onCommit={(qty) =>
                  updateLine(
                    line.id,
                    qty,
                    line.unit_cost,
                    line.batch_number ?? null,
                    line.production_date ?? null,
                    line.expiry_date ?? null
                  )
                }
              />
            ) : (
              <p className="min-h-11 content-center text-sm">
                {line.quantity}
                {unit ? ` ${unit}` : ""}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">التكلفة</Label>
            {isDraft ? (
              <DraftDecimalInput
                className="min-h-11"
                value={line.unit_cost}
                emptyFallback={0}
                onCommit={(cost) =>
                  updateLine(
                    line.id,
                    line.quantity,
                    cost,
                    line.batch_number ?? null,
                    line.production_date ?? null,
                    line.expiry_date ?? null
                  )
                }
              />
            ) : (
              <p className="min-h-11 content-center text-sm">
                {formatCurrency(line.unit_cost, currency)}
              </p>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">الإجمالي</span>
          <span className="font-semibold">
            {formatCurrency(line.landed_line_total ?? line.line_total, currency)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <OperationalCard
        title={`فاتورة ${invoice.invoice_number}`}
        description={
          isDraft
            ? "امسح → كمية → إضافة. البنود تظهر فورًا وتُحفظ في الخلفية."
            : `الحالة: ${statusLabels[invoice.status] ?? invoice.status} · ${invoice.supplierName} · ${invoice.warehouseName}`
        }
      >
        {isDraft && (
          <>
            <p className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground sm:text-sm">
              مسودة محفوظة — المخزون لم يتحدث بعد
            </p>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-3 h-9 gap-1 px-0 text-muted-foreground"
              onClick={() => setShowHeader((v) => !v)}
            >
              {showHeader ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              بيانات الفاتورة (مورد / رقم / إضافات)
            </Button>

            {showHeader ? (
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>المورد</Label>
                  <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
                    <SelectTrigger className="min-h-11 w-full">
                      <SelectValue>
                        {(value) => selectLabelById(suppliers, value, (s) => s.name)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id} label={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المخزن</Label>
                  <Select value={warehouseId} disabled>
                    <SelectTrigger className="min-h-11 w-full">
                      <SelectValue>
                        {(value) => selectLabelById(warehouses, value, (w) => w.name)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id} label={w.name}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>رقم الفاتورة</Label>
                  <div className="flex gap-2">
                    <Input
                      className="min-h-11"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 shrink-0"
                      onClick={saveHeader}
                      disabled={pending}
                    >
                      حفظ
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>تكلفة إضافية</Label>
                  <Input
                    className="min-h-11"
                    type="text"
                    inputMode="decimal"
                    value={extraCost}
                    onChange={(e) => setExtraCost(sanitizeDecimalInput(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>
            ) : null}

            <form onSubmit={handleBarcodeSubmit} className="grid gap-3">
              <div className="relative space-y-2">
                <Label className="flex items-center gap-2">
                  <Barcode className="size-4" /> باركود / بحث منتج
                </Label>
                <Input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => {
                    const value = e.target.value;
                    setBarcode(value);
                    setSearchOpen(value.trim().length > 0);
                    setHighlightIndex(0);
                    if (selectedProductId) {
                      const selected = productMap.get(selectedProductId);
                      if (selected && value !== selected.name) {
                        setSelectedProductId("");
                      }
                    }
                  }}
                  onFocus={() => {
                    if (barcode.trim().length > 0) setSearchOpen(true);
                  }}
                  onBlur={() => {
                    // Delay so list item click registers
                    setTimeout(() => setSearchOpen(false), 150);
                  }}
                  onKeyDown={(e) => {
                    if (!searchOpen || searchMatches.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightIndex((i) => (i + 1) % searchMatches.length);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightIndex(
                        (i) => (i - 1 + searchMatches.length) % searchMatches.length
                      );
                    } else if (e.key === "Escape") {
                      setSearchOpen(false);
                    }
                  }}
                  placeholder="امسح باركود أو ابحث بالاسم…"
                  autoComplete="off"
                  enterKeyHint="next"
                  className="min-h-12 text-lg"
                />
                {searchOpen && barcode.trim().length > 0 ? (
                  <ul
                    role="listbox"
                    className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border/70 bg-popover p-1 shadow-lg"
                  >
                    {searchMatches.length === 0 ? (
                      <li className="px-3 py-3 text-sm text-muted-foreground">
                        لا يوجد منتج مطابق
                      </li>
                    ) : (
                      searchMatches.map((p, index) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={index === highlightIndex}
                            className={
                              index === highlightIndex
                                ? "flex w-full flex-col items-start gap-0.5 rounded-lg bg-accent px-3 py-2.5 text-right"
                                : "flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-right hover:bg-muted/60"
                            }
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              selectProduct(p);
                            }}
                            onMouseEnter={() => setHighlightIndex(index)}
                          >
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatUnit(p.unit)}
                              {p.sku ? ` · ${p.sku}` : ""}
                              {p.barcode ? ` · ${p.barcode}` : ""}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>المنتج {selectedProduct ? "المختار" : ""}</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={(v) => {
                    const p = productMap.get(v ?? "");
                    if (p) selectProduct(p);
                    else setSelectedProductId("");
                  }}
                >
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue placeholder="أو اختار من القائمة">
                      {(value) => {
                        const p = products.find((x) => x.id === value);
                        return p ? productLabel(p) : "أو اختار من القائمة";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id} label={productLabel(p)}>
                        {productLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {selectedHasPacking ? (
                  <div className="col-span-2 space-y-2 sm:col-span-1">
                    <Label>وحدة الإدخال</Label>
                    <Select
                      value={entryUnit}
                      onValueChange={(v) =>
                        setEntryUnit((v as MeasurementUnit) ?? selectedBaseUnit)
                      }
                    >
                      <SelectTrigger className="min-h-11 w-full">
                        <SelectValue>{() => formatUnit(entryUnit)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectedBaseUnit} label={formatUnit(selectedBaseUnit)}>
                          {formatUnit(selectedBaseUnit)}
                        </SelectItem>
                        <SelectItem
                          value={selectedPurchaseUnit}
                          label={formatUnit(selectedPurchaseUnit)}
                        >
                          {formatUnit(selectedPurchaseUnit)} ({selectedFactor}{" "}
                          {formatUnit(selectedBaseUnit)})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>
                    الكمية
                    {selectedProduct
                      ? ` (${formatUnit(selectedHasPacking ? entryUnit : selectedBaseUnit)})`
                      : ""}
                  </Label>
                  <Input
                    ref={qtyRef}
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="next"
                    className="min-h-11"
                    value={quantity}
                    onChange={(e) => setQuantity(sanitizeDecimalInput(e.target.value))}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    التكلفة
                    {selectedProduct
                      ? ` / ${formatUnit(selectedHasPacking ? entryUnit : selectedBaseUnit)}`
                      : ""}
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    className="min-h-11"
                    value={unitCost}
                    onChange={(e) => setUnitCost(sanitizeDecimalInput(e.target.value))}
                    placeholder={
                      selectedProduct && selectedProduct.last_unit_cost > 0
                        ? String(selectedProduct.last_unit_cost)
                        : "آخر تكلفة"
                    }
                  />
                </div>
              </div>
              {entryPreview ? (
                <p className="text-xs text-muted-foreground">
                  يتحوّل للمخزون: {entryPreview.quantity} {formatUnit(selectedBaseUnit)} ×{" "}
                  {formatCurrency(entryPreview.unitCost, currency)} ={" "}
                  {formatCurrency(entryPreview.lineTotal, currency)}
                </p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 justify-start gap-1 px-0 text-muted-foreground"
                onClick={() => setShowLineDetails((v) => !v)}
              >
                {showLineDetails ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
                تفاصيل إضافية (تشغيلة / صلاحية)
              </Button>
              {showLineDetails ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>رقم التشغيلة</Label>
                    <Input
                      className="min-h-11"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      placeholder="اختياري"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الإنتاج</Label>
                    <Input
                      className="min-h-11"
                      type="date"
                      value={productionDate}
                      onChange={(e) => setProductionDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الانتهاء</Label>
                    <Input
                      className="min-h-11"
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>محسوب تلقائيًا</Label>
                    <Input
                      className="min-h-11"
                      value={calculatedExpiryDate ?? "-"}
                      readOnly
                    />
                  </div>
                </div>
              ) : null}
              <Button
                type="submit"
                className="min-h-12 w-full text-base"
                disabled={!selectedProductId && !barcode.trim()}
              >
                <Plus className="size-4" /> إضافة للصنف
              </Button>
            </form>
          </>
        )}
      </OperationalCard>

      {invoice.lines.length > 0 && (
        <OperationalCard title={`البنود (${invoice.lines.length})`}>
          {/* Mobile-first cards */}
          <div className="grid gap-3 md:hidden">
            {invoice.lines.map((line) => renderLineEditor(line))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead className="text-right">الكمية</TableHead>
                  <TableHead className="text-right">تكلفة الوحدة</TableHead>
                  {!isDraft && <TableHead className="text-right">بعد الإضافات</TableHead>}
                  <TableHead className="text-right">الإجمالي</TableHead>
                  {isDraft && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => {
                  const lineProduct = productMap.get(line.product_id);
                  const unit = lineProduct
                    ? formatUnit(lineProduct.base_unit ?? lineProduct.unit)
                    : "";
                  return (
                    <TableRow key={line.id}>
                      <TableCell>{lineProduct?.name ?? line.product_id}</TableCell>
                      <TableCell className="text-right">
                        {isDraft ? (
                          <DraftDecimalInput
                            className="ml-auto w-24"
                            value={line.quantity}
                            emptyFallback={1}
                            onCommit={(qty) =>
                              updateLine(
                                line.id,
                                qty,
                                line.unit_cost,
                                line.batch_number ?? null,
                                line.production_date ?? null,
                                line.expiry_date ?? null
                              )
                            }
                          />
                        ) : (
                          <span>
                            {line.quantity}
                            {unit ? ` ${unit}` : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isDraft ? (
                          <DraftDecimalInput
                            className="ml-auto w-28"
                            value={line.unit_cost}
                            emptyFallback={0}
                            onCommit={(cost) =>
                              updateLine(
                                line.id,
                                line.quantity,
                                cost,
                                line.batch_number ?? null,
                                line.production_date ?? null,
                                line.expiry_date ?? null
                              )
                            }
                          />
                        ) : (
                          formatCurrency(line.unit_cost, currency)
                        )}
                      </TableCell>
                      {!isDraft && (
                        <TableCell className="text-right">
                          {formatCurrency(line.landed_unit_cost ?? line.unit_cost, currency)}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.landed_line_total ?? line.line_total, currency)}
                      </TableCell>
                      {isDraft && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLine(line.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </OperationalCard>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:pl-64">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline justify-between gap-3 sm:block">
            <p className="text-sm text-muted-foreground">{invoice.lines.length} بند</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(invoice.total || subtotal, currency)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                if (isDraft) {
                  toast.success("تم الحفظ المؤقت — تابع لاحقًا من القائمة");
                }
                onComplete();
              }}
            >
              {invoice.status === "cancelled"
                ? "رجوع"
                : isDraft
                  ? "حفظ مؤقت"
                  : "إغلاق"}
            </Button>
            {isDraft && (
              <>
                <Button
                  variant="destructive"
                  className="min-h-11"
                  onClick={() => setConfirmDelete(true)}
                >
                  حذف
                </Button>
                <Button
                  className="col-span-2 min-h-12 text-base sm:col-span-1 sm:min-w-40"
                  onClick={() => {
                    setAmountPaidNow("0");
                    setReceivePaymentMethod("cash");
                    setConfirmReceive(true);
                  }}
                  disabled={invoice.lines.length === 0}
                >
                  حفظ نهائي وتحديث المخزون
                </Button>
              </>
            )}
            {isReceived && (
              <Button
                variant="outline"
                className="col-span-2 min-h-11"
                onClick={() => setConfirmVoid(true)}
              >
                إلغاء الاستلام
              </Button>
            )}
          </div>
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف مسودة الشراء؟"
        description="سيتم حذف الفاتورة وبنودها نهائيًا. المخزون لم يتم تحديثه بعد."
        confirmLabel="حذف"
        destructive
        onConfirm={handleDeleteDraft}
      />

      <Dialog
        open={confirmReceive}
        onOpenChange={(open) => {
          if (!receivePending) setConfirmReceive(open);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حفظ نهائي وتحديث المخزون؟</DialogTitle>
            <DialogDescription>
              سيتم تأكيد الفاتورة وإضافة {invoice?.lines.length ?? 0} بند إلى المخزون.
              الإجمالي {invoice ? formatCurrency(invoice.total, currency) : "—"}.
              لو حصل غلط تقدّر تلغي الاستلام وتعدّل وترجع تستلم (مالك/مدير).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>دفعت الآن (اختياري)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountPaidNow}
                onChange={(e) => setAmountPaidNow(sanitizeDecimalInput(e.target.value))}
              />
            </div>
            <div className="rounded-[var(--mds-radius-lg)] bg-muted/50 px-3 py-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">إجمالي الفاتورة</span>
                <span className="tabular-nums font-medium">
                  {invoice ? formatCurrency(invoice.total, currency) : "—"}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-muted-foreground">الباقي على المورد</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(Math.max(0, receiveRemaining), currency)}
                </span>
              </div>
            </div>
            {(parseFloat(amountPaidNow) || 0) > 0 ? (
              <div className="space-y-2">
                <Label>طريقة الدفع</Label>
                <Select
                  value={receivePaymentMethod}
                  onValueChange={(v) => setReceivePaymentMethod(v as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => (value ? t(String(value)) : null)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.filter((m) => m !== "credit").map((m) => (
                      <SelectItem key={m} value={m} label={t(m)}>
                        {t(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmReceive(false)}
              disabled={receivePending}
            >
              إلغاء
            </Button>
            <Button onClick={handleReceive} disabled={receivePending}>
              تأكيد وتحديث المخزون
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        title="إلغاء الاستلام؟"
        description="هيتم عكس الكميات من المخزون وترجع الفاتورة مسودة عشان تعدّل وتستلم تاني. يتطلب مالكًا أو مديرًا."
        confirmLabel="إلغاء وإعادة للمسودة"
        destructive
        onConfirm={handleVoid}
      />
    </div>
  );
}
