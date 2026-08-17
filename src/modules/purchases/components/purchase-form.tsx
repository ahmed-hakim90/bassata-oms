"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { Plus, Tags, Trash2, X, Save, PackageCheck, FileText, Receipt, Undo2, Loader2, Send, MessageCircle, Settings } from "lucide-react";
import { toast } from "sonner";
import {
  backgroundMutationKey,
  useBackgroundMutation,
} from "@/hooks/use-background-mutation";
import { useOperatorShortcuts } from "@/hooks/use-operator-shortcuts";
import { useUndoStack } from "@/hooks/use-undo-stack";
import { OPERATOR_SHORTCUTS } from "@/lib/keyboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { OperatorShortcutHint } from "@/components/Velora/operator-shortcut-hint";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock, LoadingStateBlock } from "@/components/Velora/state-blocks";
import { DocumentPrintPreviewModal } from "@/components/print/document-print-preview-modal";
import { CreateContainerInline } from "@/modules/purchases/components/containers-page";
import { formatCurrency } from "@/lib/format";
import { lineTotalAfterDiscount } from "@/lib/line-discount";
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
  suggestedPurchaseEntryUnitCost,
} from "@/lib/units";
import { ProductSearchCombobox } from "@/modules/products/components/product-search-combobox";
import { matchProducts } from "@/modules/products/lib/match-products";
import type {
  MeasurementUnit,
  PaymentMethod,
  Product,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  Supplier,
  Warehouse,
} from "@/lib/types";
import {
  addPurchaseLineAction,
  convertPurchaseDocumentAction,
  createPurchaseAction,
  deleteDraftPurchaseAction,
  getPurchaseDetailAction,
  importPurchaseOrdersIntoInvoiceAction,
  listImportablePurchaseOrdersAction,
  postPurchaseReturnAction,
  previewPurchaseConvertAction,
  receivePurchaseAction,
  removePurchaseLineAction,
  transitionPurchaseDocumentAction,
  updateDraftPurchaseAction,
  updatePurchaseLineAction,
  voidPurchaseAction,
} from "@/modules/purchases/actions/purchase.actions";
import {
  buildWhatsAppDocumentUrl,
  formatCommercialDocumentForWhatsApp,
} from "@/modules/pos/services/receipt-format.service";
import { COMMERCIAL_DOCUMENT_KIND_LABELS } from "@/modules/print-engine/lib/print-engine-settings";
import type {
  ImportablePurchaseOrder,
  PurchaseWithLines,
} from "@/modules/purchases/services/purchase.service";

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

const LOCAL_DRAFT_PREFIX = "local-";

function isLocalDraftId(id: string) {
  return id.startsWith(LOCAL_DRAFT_PREFIX);
}

function buildLocalPurchaseDraft(input: {
  documentKind: NonNullable<PurchaseInvoice["document_kind"]>;
  supplierId: string;
  warehouseId: string;
  suppliers: Supplier[];
  warehouses: Warehouse[];
  documentDate: string;
  extraCost?: number;
}): PurchaseWithLines {
  const supplier = input.suppliers.find((s) => s.id === input.supplierId);
  const warehouse = input.warehouses.find((w) => w.id === input.warehouseId);
  const extra = Math.max(0, input.extraCost ?? 0);
  const now = new Date().toISOString();
  return {
    id: `${LOCAL_DRAFT_PREFIX}${crypto.randomUUID()}`,
    store_id: "",
    warehouse_id: input.warehouseId,
    supplier_id: input.supplierId || null,
    invoice_number: "مسودة جديدة",
    status: "draft",
    document_kind: input.documentKind,
    source_document_id: null,
    document_notes: "",
    subtotal: 0,
    extra_cost: extra,
    tax: 0,
    total: extra,
    document_date: input.documentDate,
    received_at: null,
    cancelled_at: null,
    created_by: "",
    created_at: now,
    lines: [],
    supplierName: supplier?.name ?? (input.supplierId ? "" : "بدون مورد"),
    warehouseName: warehouse?.name ?? "",
    supplierAddress: supplier?.address ?? null,
    supplierTaxId: supplier?.tax_id ?? null,
    supplierContact: supplier?.contact_info ?? null,
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
  documentKind?: NonNullable<PurchaseInvoice["document_kind"]>;
  canManagePrintEngine?: boolean;
  /** Manual feature: containers + document FX. Never activity-driven. */
  importsEnabled?: boolean;
  onComplete: () => void;
}

export function PurchaseForm({
  suppliers,
  products,
  warehouses,
  currency,
  initialInvoiceId,
  documentKind = "purchase_invoice",
  canManagePrintEngine = false,
  importsEnabled = false,
  onComplete,
}: PurchaseFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(!!initialInvoiceId);
  const defaultWarehouseId =
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? "";
  const defaultSupplierId = suppliers[0]?.id ?? "";
  const [invoice, setInvoice] = useState<PurchaseWithLines | null>(() => {
    if (initialInvoiceId) return null;
    if (!defaultWarehouseId) return null;
    if (documentKind !== "purchase_request" && !defaultSupplierId) return null;
    return buildLocalPurchaseDraft({
      documentKind,
      supplierId: defaultSupplierId,
      warehouseId: defaultWarehouseId,
      suppliers,
      warehouses,
      documentDate: new Date().toISOString().slice(0, 10),
    });
  });
  const [supplierId, setSupplierId] = useState(defaultSupplierId);
  const { run: runBackground } = useBackgroundMutation();
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [documentDate, setDocumentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [extraCost, setExtraCost] = useState("");
  const [docCurrency, setDocCurrency] = useState(currency);
  const [fxRate, setFxRate] = useState("1");
  const [documentNotes, setDocumentNotes] = useState("");
  const [poContainers, setPoContainers] = useState<
    import("@/modules/purchases/services/purchase-container.service").ContainerWithLines[]
  >([]);
  const [containersLoaded, setContainersLoaded] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [lineDiscount, setLineDiscount] = useState("");
  const [entryUnit, setEntryUnit] = useState<MeasurementUnit>("piece");
  const [batchNumber, setBatchNumber] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [confirmReceive, setConfirmReceive] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertRows, setConvertRows] = useState<
    Array<{ sourceLineId: string; productId: string; remaining: number; qty: string }>
  >([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importableOrders, setImportableOrders] = useState<ImportablePurchaseOrder[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [printPreview, setPrintPreview] = useState<{
    href: string;
    title: string;
  } | null>(null);
  const [amountPaidNow, setAmountPaidNow] = useState("0");
  const [receivePaymentMethod, setReceivePaymentMethod] =
    useState<PaymentMethod>("cash");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const snapshotRef = useRef<PurchaseWithLines | null>(null);
  const invoiceRef = useRef<PurchaseWithLines | null>(null);
  const persistPromiseRef = useRef<Promise<PurchaseWithLines | null> | null>(null);
  const isUndoingRef = useRef(false);
  const cancelledTempIdsRef = useRef(new Set<string>());
  const removeLineRef = useRef<(lineId: string) => void>(() => {});
  const updateLineRef = useRef<
    (
      lineId: string,
      qty: number,
      cost: number,
      nextBatchNumber?: string | null,
      nextProductionDate?: string | null,
      nextExpiryDate?: string | null
    ) => void
  >(() => {});
  const addLineForUndoRef = useRef<
    (
      productId: string,
      qty: number,
      cost: number,
      lineEntryUnit: MeasurementUnit,
      lineBatchNumber?: string | null,
      lineProductionDate?: string | null,
      lineExpiryDate?: string | null
    ) => void
  >(() => {});
  const { push: pushUndo, undo: undoLast, clear: clearUndo } = useUndoStack();

  invoiceRef.current = invoice;

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const selectProduct = useCallback((product: Product) => {
    setSelectedProductId(product.id);
    setUnitCost("");
    const base = product.base_unit ?? product.unit;
    setEntryUnit(productHasPurchasePacking(product) ? product.cost_unit : base);
    setBarcode(product.name);
    setHighlightIndex(0);
    setQuantity((prev) => (prev.trim() ? prev : "1"));
    setTimeout(() => {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }, 50);
  }, []);

  const selectedProduct = selectedProductId ? productMap.get(selectedProductId) : undefined;
  const selectedHasPacking = selectedProduct ? productHasPurchasePacking(selectedProduct) : false;
  const selectedBaseUnit = selectedProduct
    ? (selectedProduct.base_unit ?? selectedProduct.unit)
    : "piece";
  const selectedPurchaseUnit = selectedProduct?.cost_unit ?? selectedBaseUnit;
  const selectedFactor = selectedProduct ? productPurchaseFactor(selectedProduct) : 1;
  const suggestedEntryCost = selectedProduct
    ? suggestedPurchaseEntryUnitCost(selectedProduct, entryUnit)
    : 0;
  const parsedQuantity = parseFloat(quantity);
  const parsedUnitCost = parseFloat(unitCost);
  const entryPreview =
    selectedProduct && selectedHasPacking && parsedQuantity > 0
      ? convertPurchaseEntryToBase({
          quantity: parsedQuantity,
          unitCost:
            Number.isFinite(parsedUnitCost) && parsedUnitCost >= 0
              ? parsedUnitCost
              : suggestedEntryCost,
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
    setQuantity("1");
    setUnitCost("");
    setLineDiscount("");
    setEntryUnit("piece");
    setBatchNumber("");
    setProductionDate("");
    setExpiryDate("");
    setSelectedProductId("");
    setHighlightIndex(0);
    setTimeout(() => productSearchRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (!initialInvoiceId) return;
    setLoading(true);
    startTransition(async () => {
      const result = await getPurchaseDetailAction(initialInvoiceId);
      setLoading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInvoice(result.data);
      setSupplierId(result.data.supplier_id ?? "");
      setWarehouseId(result.data.warehouse_id);
      setInvoiceNumber(result.data.invoice_number);
      setDocumentDate(
        result.data.document_date ?? result.data.created_at.slice(0, 10)
      );
      setExtraCost(
        result.data.extra_cost > 0 ? String(result.data.extra_cost) : ""
      );
      setDocCurrency(result.data.currency ?? currency);
      setFxRate(String(result.data.fx_rate ?? 1));
      setDocumentNotes(result.data.document_notes ?? "");
      setTimeout(() => productSearchRef.current?.focus(), 100);
    });
  }, [initialInvoiceId, currency]);

  useEffect(() => {
    if (
      !importsEnabled ||
      documentKind !== "purchase_order" ||
      !invoice ||
      isLocalDraftId(invoice.id)
    ) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const { listContainersAction } = await import(
        "@/modules/purchases/actions/purchase-import.actions"
      );
      const result = await listContainersAction({ purchaseOrderId: invoice.id });
      if (cancelled) return;
      if (result.ok) {
        setPoContainers(result.data);
        setContainersLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [importsEnabled, documentKind, invoice?.id]);

  useEffect(() => {
    if (initialInvoiceId || !invoice || !isLocalDraftId(invoice.id)) return;
    setTimeout(() => productSearchRef.current?.focus(), 50);
  }, [initialInvoiceId, invoice?.id]);

  const ensurePersistedDraft = useCallback(async (): Promise<PurchaseWithLines | null> => {
    const current = invoiceRef.current;
    if (!current) return null;
    if (!isLocalDraftId(current.id)) return current;

    const nextWarehouseId = warehouseId || current.warehouse_id;
    const nextSupplierId = supplierId || current.supplier_id || "";
    if (!nextWarehouseId) {
      toast.error("اختار المخزن");
      return null;
    }
    if (documentKind !== "purchase_request" && !nextSupplierId) {
      toast.error("اختار المورد");
      return null;
    }

    if (persistPromiseRef.current) return persistPromiseRef.current;

    persistPromiseRef.current = (async () => {
      const result = await createPurchaseAction({
        supplierId: nextSupplierId || null,
        warehouseId: nextWarehouseId,
        extraCost: parseFloat(extraCost) || current.extra_cost || 0,
        documentDate: documentDate || current.document_date,
        documentKind,
        ...(importsEnabled
          ? {
              currency: docCurrency,
              fxRate: parseFloat(fxRate) || 1,
            }
          : {}),
      });
      if (!result.ok) {
        toast.error(result.error);
        return null;
      }
      const supplier = suppliers.find((s) => s.id === nextSupplierId);
      const persisted: PurchaseWithLines = {
        ...result.data,
        lines: [],
        supplierName: supplier?.name ?? (nextSupplierId ? "" : "بدون مورد"),
        warehouseName: warehouses.find((w) => w.id === nextWarehouseId)?.name ?? "",
        supplierAddress: supplier?.address ?? null,
        supplierTaxId: supplier?.tax_id ?? null,
        supplierContact: supplier?.contact_info ?? null,
      };
      setInvoiceNumber(persisted.invoice_number);
      setInvoice(persisted);
      invoiceRef.current = persisted;
      return persisted;
    })().finally(() => {
      persistPromiseRef.current = null;
    });

    return persistPromiseRef.current;
  }, [
    warehouseId,
    supplierId,
    documentKind,
    extraCost,
    documentDate,
    suppliers,
    warehouses,
    importsEnabled,
    docCurrency,
    fxRate,
  ]);

  const addLine = useCallback(
    (
      productId: string,
      qty: number,
      cost: number,
      lineEntryUnit: MeasurementUnit,
      lineBatchNumber?: string | null,
      lineProductionDate?: string | null,
      lineExpiryDate?: string | null,
      discountAmount = 0
    ) => {
      void (async () => {
        let inv = invoiceRef.current;
        if (!inv || qty <= 0 || cost < 0) return;

        if (isLocalDraftId(inv.id)) {
          const persisted = await ensurePersistedDraft();
          if (!persisted) return;
          inv = persisted;
        }

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

        snapshotRef.current = inv;
        const existing = inv.lines.find(
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
          nextLines = inv.lines.map((l) =>
            l.id === existing.id
              ? {
                  ...l,
                  quantity: mergedQty,
                  unit_cost: blendedCost,
                  discount_amount: Number(((existing.discount_amount ?? 0) + Math.max(0, discountAmount)).toFixed(2)),
                  line_total: lineTotalAfterDiscount(
                    mergedQty,
                    blendedCost,
                    (existing.discount_amount ?? 0) + Math.max(0, discountAmount)
                  ),
                  batch_number: lineBatchNumber ?? null,
                  production_date: lineProductionDate ?? null,
                  expiry_date: lineExpiryDate ?? null,
                }
              : l
          );
        } else {
          optimisticId = `temp-${crypto.randomUUID()}`;
          nextLines = [
            ...inv.lines,
            {
              id: optimisticId,
              invoice_id: inv.id,
              product_id: productId,
              variant_id: null,
              quantity: converted.quantity,
              unit_cost: converted.unitCost,
              discount_amount: Math.max(0, discountAmount),
              line_total: lineTotalAfterDiscount(
                converted.quantity,
                converted.unitCost,
                Math.max(0, discountAmount)
              ),
              landed_unit_cost: null,
              landed_line_total: null,
              batch_number: lineBatchNumber ?? null,
              production_date: lineProductionDate ?? null,
              expiry_date: lineExpiryDate ?? null,
            },
          ];
        }

        setInvoice({
          ...inv,
          ...withLineTotals(nextLines, inv.extra_cost),
        });
        resetLineInputs();
        toast.success(`تمت إضافة ${product.name}`);

        if (!isUndoingRef.current) {
          const priorQty = existing?.quantity ?? 0;
          const priorCost = existing?.unit_cost ?? 0;
          const merged = Boolean(existing);
          pushUndo({
            undo: () => {
              const current = invoiceRef.current;
              if (!current) return;
              const line = current.lines.find(
                (l) => l.product_id === productId && l.variant_id == null
              );
              if (!line) return;
              isUndoingRef.current = true;
              if (!merged || priorQty <= 0) {
                removeLineRef.current?.(line.id);
              } else {
                updateLineRef.current?.(line.id, priorQty, priorCost);
              }
              isUndoingRef.current = false;
            },
          });
        }

        const rate = parseFloat(fxRate) || 1;
        const foreign =
          importsEnabled && docCurrency !== currency
            ? cost
            : null;
        const unitCostBase =
          foreign != null ? Number((foreign * rate).toFixed(4)) : cost;
        const result = await addPurchaseLineAction({
          invoiceId: inv.id,
          productId,
          quantity: qty,
          unitCost: unitCostBase,
          foreignUnitCost: foreign,
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
        if (cancelledTempIdsRef.current.has(optimisticId)) {
          cancelledTempIdsRef.current.delete(optimisticId);
          if (!result.data.id.startsWith("temp-")) {
            void removePurchaseLineAction(result.data.id);
          }
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
    [ensurePersistedDraft, productMap, pushUndo, importsEnabled, docCurrency, currency, fxRate]
  );

  const lookupBarcode = (code: string) => {
    const normalized = code.trim().toLowerCase();
    if (!normalized) return undefined;
    return products.find(
      (p) =>
        p.barcode?.toLowerCase() === normalized || p.sku?.toLowerCase() === normalized
    );
  };


  const allowZeroUnitCost =
    documentKind === "purchase_order" || documentKind === "purchase_request";
  const parsedLineDiscount = parseFloat(lineDiscount);
  const resolveAddUnitCost = (product: Product) => {
    if (unitCost.trim() === "") {
      return allowZeroUnitCost ? 0 : suggestedPurchaseEntryUnitCost(product, entryUnit);
    }
    if (Number.isFinite(parsedUnitCost) && parsedUnitCost >= 0) return parsedUnitCost;
    return allowZeroUnitCost ? 0 : suggestedPurchaseEntryUnitCost(product, entryUnit);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = lookupBarcode(barcode);

    if (found) {
      if (selectedProductId === found.id) {
        addLine(
          found.id,
          Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1,
          resolveAddUnitCost(found),
          entryUnit,
          batchNumber || null,
          productionDate || null,
          expiryDate || calculatedExpiryDate || null,
          Number.isFinite(parsedLineDiscount) && parsedLineDiscount > 0 ? parsedLineDiscount : 0
        );
        return;
      }
      selectProduct(found);
      return;
    }

    if (selectedProductId) {
      const product = productMap.get(selectedProductId);
      if (!product) {
        toast.error("المنتج غير موجود");
        return;
      }
      addLine(
        selectedProductId,
        Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1,
        resolveAddUnitCost(product),
        entryUnit,
        batchNumber || null,
        productionDate || null,
        expiryDate || calculatedExpiryDate || null,
        Number.isFinite(parsedLineDiscount) && parsedLineDiscount > 0 ? parsedLineDiscount : 0
      );
      return;
    }

    const searchMatches = matchProducts(products, barcode);
    if (searchMatches.length === 1) {
      selectProduct(searchMatches[0]!);
      return;
    }
    if (searchMatches.length > 1) {
      selectProduct(searchMatches[Math.min(highlightIndex, searchMatches.length - 1)]!);
      return;
    }
    toast.error("المنتج غير موجود");
  };

  const handleReceive = () => {
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

    const invoiceId = invoice.id;
    const invoiceTotal = invoice.total;
    const paymentMethod = paid > 0 ? receivePaymentMethod : undefined;
    const mutationKey = backgroundMutationKey("purchase", "receive", invoiceId);

    setConfirmReceive(false);
    onComplete();

    runBackground({
      key: mutationKey,
      label: "جاري استلام فاتورة الشراء…",
      execute: async () => {
        const result = await receivePurchaseAction(invoiceId, {
          amountPaid: paid,
          paymentMethod,
        });
        if (!result.ok) throw new Error(result.error);
        return result.data;
      },
      successMessage: (data) => {
        const remaining = Number((invoiceTotal - data.amountPaid).toFixed(2));
        return data.amountPaid > 0
          ? `تم الاستلام — دُفع ${formatCurrency(data.amountPaid, currency)}، الباقي ${formatCurrency(remaining, currency)}`
          : "تم الحفظ النهائي — تم تحديث المخزون";
      },
      onSuccess: (data) => {
        toast.message("تقدر تعمل قائمة أسعار من الفاتورة", {
          action: {
            label: "قائمة أسعار",
            onClick: () => {
              router.push(`/inventory/purchases/price-list?invoice=${data.id}`);
            },
          },
        });
        router.refresh();
      },
    });
  };

  const receiveRemaining = invoice
    ? Number((invoice.total - (parseFloat(amountPaidNow) || 0)).toFixed(2))
    : 0;

  const commitHeader = useCallback(() => {
    if (!invoice) return;
    const kind = invoice.document_kind ?? documentKind;
    const prOpen =
      kind === "purchase_request" &&
      (invoice.status === "draft" ||
        invoice.status === "submitted" ||
        invoice.status === "approved");
    if (invoice.status !== "draft" && !prOpen) return;
    const nextExtra = parseFloat(extraCost) || 0;
    const supplier = suppliers.find((s) => s.id === supplierId);
    const invoiceNumberTrimmed = invoiceNumber.trim();
    const notesTrimmed = documentNotes.trim();
    const warehouse = warehouses.find((w) => w.id === warehouseId);
    snapshotRef.current = invoice;

    if (isLocalDraftId(invoice.id)) {
      setInvoice({
        ...invoice,
        supplier_id: supplierId || null,
        warehouse_id: warehouseId || invoice.warehouse_id,
        invoice_number: invoiceNumberTrimmed || invoice.invoice_number,
        document_date: documentDate,
        document_notes: notesTrimmed,
        ...withLineTotals(invoice.lines, nextExtra),
        supplierName: supplier?.name ?? (supplierId ? invoice.supplierName : "بدون مورد"),
        warehouseName: warehouse?.name ?? invoice.warehouseName,
        supplierAddress: supplier?.address ?? null,
        supplierTaxId: supplier?.tax_id ?? null,
        supplierContact: supplier?.contact_info ?? null,
      });
      return;
    }

    setInvoice({
      ...invoice,
      supplier_id: supplierId || null,
      invoice_number: invoiceNumberTrimmed,
      document_date: documentDate,
      document_notes: notesTrimmed,
      ...withLineTotals(invoice.lines, nextExtra),
      supplierName: supplier?.name ?? (supplierId ? invoice.supplierName : "بدون مورد"),
    });

    void (async () => {
      const result = await updateDraftPurchaseAction({
        invoiceId: invoice.id,
        supplierId: supplierId || null,
        ...(invoice.status === "draft"
          ? {
              invoiceNumber: invoiceNumberTrimmed,
              extraCost: nextExtra,
              documentDate,
              documentNotes: notesTrimmed,
              ...(importsEnabled
                ? {
                    currency: docCurrency,
                    fxRate: parseFloat(fxRate) || 1,
                  }
                : {}),
            }
          : {}),
      });
      if (!result.ok) {
        if (snapshotRef.current) setInvoice(snapshotRef.current);
        toast.error(result.error);
        return;
      }
      setInvoice((prev) =>
        prev
          ? {
              ...prev,
              ...result.data,
              ...withLineTotals(prev.lines, nextExtra),
              supplierName: supplier?.name ?? prev.supplierName,
            }
          : prev
      );
    })();
  }, [
    invoice,
    extraCost,
    suppliers,
    supplierId,
    warehouseId,
    warehouses,
    invoiceNumber,
    documentDate,
    documentNotes,
    documentKind,
    importsEnabled,
    docCurrency,
    fxRate,
  ]);

  const updateLine = (
    lineId: string,
    qty: number,
    cost: number,
    nextBatchNumber?: string | null,
    nextProductionDate?: string | null,
    nextExpiryDate?: string | null,
    nextDiscountAmount?: number
  ) => {
    if (!invoice || qty <= 0 || cost < 0) return;
    if (lineId.startsWith("temp-")) return;

    const existing = invoice.lines.find((l) => l.id === lineId);
    const discountAmount = Math.max(
      0,
      nextDiscountAmount !== undefined
        ? nextDiscountAmount
        : (existing?.discount_amount ?? 0)
    );

    snapshotRef.current = invoice;
    const nextLines = invoice.lines.map((l) =>
      l.id === lineId
        ? {
            ...l,
            quantity: qty,
            unit_cost: cost,
            discount_amount: discountAmount,
            line_total: lineTotalAfterDiscount(qty, cost, discountAmount),
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
        discountAmount,
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
    const removed = invoice.lines.find((l) => l.id === lineId);
    snapshotRef.current = invoice;
    const nextLines = invoice.lines.filter((l) => l.id !== lineId);
    setInvoice({ ...invoice, ...withLineTotals(nextLines, invoice.extra_cost) });

    if (!isUndoingRef.current && removed) {
      const product = productMap.get(removed.product_id);
      const baseUnit = product?.base_unit ?? product?.unit ?? "piece";
      pushUndo({
        undo: () => {
          isUndoingRef.current = true;
          addLineForUndoRef.current(
            removed.product_id,
            removed.quantity,
            removed.unit_cost,
            baseUnit,
            removed.batch_number,
            removed.production_date,
            removed.expiry_date
          );
          isUndoingRef.current = false;
        },
      });
    }

    if (lineId.startsWith("temp-")) {
      cancelledTempIdsRef.current.add(lineId);
      return;
    }

    void (async () => {
      const result = await removePurchaseLineAction(lineId);
      if (!result.ok) {
        if (snapshotRef.current) setInvoice(snapshotRef.current);
        toast.error(result.error);
      }
    })();
  };

  removeLineRef.current = removeLine;
  updateLineRef.current = updateLine;
  addLineForUndoRef.current = addLine;

  useOperatorShortcuts({
    enabled: invoice?.status === "draft",
    onSave: () => {
      if (!invoice || invoice.status !== "draft") return;
      void (async () => {
        if (isLocalDraftId(invoice.id)) {
          if (invoice.lines.length === 0) {
            onComplete();
            return;
          }
          const persisted = await ensurePersistedDraft();
          if (!persisted) return;
        }
        toast.success("تم الحفظ المؤقت — تابع لاحقًا من القائمة");
        onComplete();
      })();
    },
    onDelete: () => {
      if (!invoice || invoice.status !== "draft" || invoice.lines.length === 0) return;
      const last = invoice.lines[invoice.lines.length - 1];
      if (last) removeLine(last.id);
    },
    onUndo: () => {
      if (!undoLast()) toast.message("مفيش خطوة للتراجع");
    },
  });

  const handleDeleteDraft = async () => {
    if (!invoice) return;
    if (isLocalDraftId(invoice.id)) {
      clearUndo();
      onComplete();
      return;
    }
    const result = await deleteDraftPurchaseAction(invoice.id);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    clearUndo();
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
    setSupplierId(result.data.supplier_id ?? "");
    setWarehouseId(result.data.warehouse_id);
    setInvoiceNumber(result.data.invoice_number);
    setExtraCost(
      result.data.extra_cost > 0 ? String(result.data.extra_cost) : ""
    );
    toast.success("تم إلغاء الاستلام — رجعت مسودة. الأصناف اللي مكانش ليها رصيد تقدر تعدّلها وتستلم تاني");
  };

  if (loading && !invoice) {
    return <LoadingStateBlock label="جاري تحميل فاتورة الشراء…" />;
  }

  const subtotal = invoice?.lines.reduce((s, l) => s + l.line_total, 0) ?? 0;
  const isDraft = invoice?.status === "draft";
  const isReceived = invoice?.status === "received";
  const kind = invoice?.document_kind ?? documentKind;
  const isPurchaseInvoice = kind === "purchase_invoice";
  const isPurchaseRequest = kind === "purchase_request";
  const isPurchaseOrder = kind === "purchase_order";
  const isPurchaseReturn = kind === "purchase_return";
  const canEditSupplier =
    isDraft ||
    (isPurchaseRequest &&
      (invoice?.status === "submitted" || invoice?.status === "approved"));
  const kindTitle =
    COMMERCIAL_DOCUMENT_KIND_LABELS[
      (kind ?? "purchase_invoice") as keyof typeof COMMERCIAL_DOCUMENT_KIND_LABELS
    ] ?? "مستند مشتريات";
  const statusLabels: Record<string, string> = {
    draft: "مسودة",
    received: "مستلمة",
    cancelled: "ملغاة",
    submitted: "مقدَّم",
    approved: "معتمد",
    rejected: "مرفوض",
    sent: "مُرسل",
    partial_invoiced: "فوترة جزئية",
    invoiced: "محوَّل",
    posted: "مرحَّل",
  };

  const openImportPurchaseOrders = async () => {
    if (!invoice || !isDraft || !isPurchaseInvoice) return;
    let target = invoice;
    if (isLocalDraftId(target.id)) {
      const persisted = await ensurePersistedDraft();
      if (!persisted) return;
      target = persisted;
    }
    setImportLoading(true);
    setImportOpen(true);
    setSelectedImportIds([]);
    const result = await listImportablePurchaseOrdersAction({
      supplierId: target.supplier_id,
      warehouseId: target.warehouse_id,
    });
    setImportLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      setImportOpen(false);
      return;
    }
    setImportableOrders(result.data);
  };

  const zeroCostLineCount =
    invoice?.lines.filter((line) => line.unit_cost === 0).length ?? 0;

  if (!invoice) {
    return (
      <EmptyStateBlock
        title="مفيش مخزن أو مورد جاهز"
        description={
          documentKind === "purchase_request"
            ? "راجع المخازن من إعدادات الفرع."
            : "ضيف مورد ومخزن الأول، بعدين افتح فاتورة جديدة."
        }
        action={
          <CompactAction label="رجوع" icon={X} onClick={onComplete} />
        }
      />
    );
  }

  const isLocalDraft = isLocalDraftId(invoice.id);

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
                                    line.expiry_date ?? null,
                                    line.discount_amount ?? 0
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
                    line.expiry_date ?? null,
                    line.discount_amount ?? 0
                  )
                }
              />
            ) : (
              <p className="min-h-11 content-center text-sm">
                {formatCurrency(line.unit_cost, currency)}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">خصم البند</Label>
            {isDraft ? (
              <DraftDecimalInput
                className="min-h-11"
                value={line.discount_amount ?? 0}
                emptyFallback={0}
                onCommit={(discount) =>
                  updateLine(
                    line.id,
                    line.quantity,
                    line.unit_cost,
                    line.batch_number ?? null,
                    line.production_date ?? null,
                    line.expiry_date ?? null,
                    discount
                  )
                }
              />
            ) : (
              <p className="min-h-11 content-center text-sm">
                {formatCurrency(line.discount_amount ?? 0, currency)}
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
    <div className="flex flex-col gap-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <OperationalCard
        accent="var(--mds-color-action-primary)"
        title={`${kindTitle} ${invoice.invoice_number}`}
        description={
          isDraft
            ? isLocalDraft
              ? "عدّل المورد والمخزن من هنا — المسودة تتسجل لما تضيف صنف أو تحفظ"
              : "مسودة — كل بيانات الفاتورة ظاهرة هنا · الأزرار ثابتة تحت"
            : `الحالة: ${statusLabels[invoice.status] ?? invoice.status}`
        }
      >
        <div className="flex flex-col gap-4">
          {isDraft ? (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground sm:text-sm">
              مسودة محفوظة — المخزون لم يتحدث بعد. أي تعديل على الرأس بيتسجل تلقائي.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>المورد{isPurchaseRequest ? " (اختياري قبل التحويل)" : ""}</Label>
              {canEditSupplier ? (
                <Select
                  value={supplierId || (isPurchaseRequest ? "__none__" : "")}
                  onValueChange={(v) => {
                    setSupplierId(!v || v === "__none__" ? "" : v);
                    window.setTimeout(() => commitHeader(), 0);
                  }}
                >
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue>
                      {(value) =>
                        value === "__none__" || !value
                          ? "بدون مورد"
                          : selectLabelById(suppliers, value, (s) => s.name)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {isPurchaseRequest ? (
                      <SelectItem value="__none__" label="بدون مورد">
                        بدون مورد
                      </SelectItem>
                    ) : null}
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id} label={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="min-h-11 content-center text-sm font-medium">
                  {invoice.supplierName || "بدون مورد"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>المخزن</Label>
              {isDraft && isLocalDraft ? (
                <Select
                  value={warehouseId}
                  onValueChange={(v) => {
                    const next = v ?? "";
                    setWarehouseId(next);
                    const warehouse = warehouses.find((w) => w.id === next);
                    setInvoice((prev) =>
                      prev
                        ? {
                            ...prev,
                            warehouse_id: next,
                            warehouseName: warehouse?.name ?? prev.warehouseName,
                          }
                        : prev
                    );
                  }}
                >
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
              ) : isDraft ? (
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
              ) : (
                <p className="min-h-11 content-center text-sm font-medium">
                  {invoice.warehouseName}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>رقم الفاتورة</Label>
              {isDraft ? (
                <Input
                  className="min-h-11"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  onBlur={commitHeader}
                />
              ) : (
                <p className="min-h-11 content-center text-sm font-medium tabular-nums">
                  {invoice.invoice_number}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الفاتورة</Label>
              {isDraft ? (
                <Input
                  className="min-h-11"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  onBlur={commitHeader}
                />
              ) : (
                <p className="min-h-11 content-center text-sm font-medium tabular-nums">
                  {invoice.document_date}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>تكلفة إضافية</Label>
              {isDraft ? (
                <Input
                  className="min-h-11"
                  type="text"
                  inputMode="decimal"
                  value={extraCost}
                  onChange={(e) => setExtraCost(sanitizeDecimalInput(e.target.value))}
                  onBlur={commitHeader}
                  placeholder="0"
                />
              ) : (
                <p className="min-h-11 content-center text-sm font-medium tabular-nums">
                  {formatCurrency(invoice.extra_cost, currency)}
                </p>
              )}
            </div>
            {importsEnabled ? (
              <>
                <div className="space-y-1.5">
                  <Label>عملة المستند</Label>
                  {isDraft ? (
                    <Select
                      value={docCurrency}
                      onValueChange={(v) => {
                        setDocCurrency(v ?? currency);
                        setTimeout(() => commitHeader(), 0);
                      }}
                    >
                      <SelectTrigger className="min-h-11 w-full">
                        <SelectValue>{() => docCurrency}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {["EGP", "USD", "EUR"].map((code) => (
                          <SelectItem key={code} value={code} label={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="min-h-11 content-center text-sm font-medium">{docCurrency}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>سعر التحويل → {currency}</Label>
                  {isDraft ? (
                    <Input
                      className="min-h-11"
                      type="text"
                      inputMode="decimal"
                      value={fxRate}
                      onChange={(e) => setFxRate(sanitizeDecimalInput(e.target.value))}
                      onBlur={commitHeader}
                      disabled={docCurrency === currency}
                    />
                  ) : (
                    <p className="min-h-11 content-center text-sm font-medium tabular-nums">
                      {fxRate}
                    </p>
                  )}
                </div>
              </>
            ) : null}
            <div className="space-y-1.5">
              <Label>الإجمالي ({currency})</Label>
              <p className="min-h-11 content-center text-base font-semibold tabular-nums">
                {formatCurrency(invoice.total || subtotal, currency)}
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات المستند</Label>
              {isDraft ? (
                <Textarea
                  className="min-h-16"
                  value={documentNotes}
                  onChange={(e) => setDocumentNotes(e.target.value)}
                  onBlur={commitHeader}
                />
              ) : (
                <p className="min-h-11 content-center whitespace-pre-wrap text-sm">
                  {invoice.document_notes || "—"}
                </p>
              )}
            </div>
          </div>

          {isDraft && isPurchaseInvoice && zeroCostLineCount > 0 ? (
            <p className="rounded-[var(--mds-radius-lg)] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              فيه {zeroCostLineCount} بند بدون تكلفة — عدّل سعر الفاتورة قبل الاستلام؛ سعر الفاتورة هو المعتمد في المخزون.
            </p>
          ) : null}

          {isDraft ? (
            <>
            <div className="space-y-3 border-t border-border/60 pt-4">
            <form
              onSubmit={handleBarcodeSubmit}
              className={
                selectedHasPacking
                  ? "grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_5.5rem_6.5rem_5.5rem_auto] sm:items-end"
                  : "grid grid-cols-1 gap-2 sm:grid-cols-[1fr_5.5rem_6.5rem_5.5rem_auto] sm:items-end"
              }
            >
              <ProductSearchCombobox
                products={products}
                value={barcode}
                onChange={(value) => {
                  setBarcode(value);
                  setHighlightIndex(0);
                  if (selectedProductId) {
                    const selected = productMap.get(selectedProductId);
                    if (selected && value !== selected.name) {
                      setSelectedProductId("");
                    }
                  }
                }}
                onSelect={selectProduct}
                onHighlightChange={setHighlightIndex}
                selectedProductId={selectedProductId}
                currency={currency}
                inputRef={productSearchRef}
                className="min-h-11"
              />
              {selectedHasPacking ? (
                <div>
                  <Label className="mb-1.5 text-xs text-muted-foreground">وحدة</Label>
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
              <div>
                <Label
                  htmlFor="purchase-line-quantity"
                  className="mb-1.5 text-xs text-muted-foreground"
                >
                  كمية
                  {selectedProduct
                    ? ` (${formatUnit(selectedHasPacking ? entryUnit : selectedBaseUnit)})`
                    : ""}
                </Label>
                <Input
                  id="purchase-line-quantity"
                  ref={qtyRef}
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  className="min-h-11 tabular-nums"
                  value={quantity}
                  onChange={(e) => setQuantity(sanitizeDecimalInput(e.target.value))}
                  placeholder="1"
                />
              </div>
              <div>
                <Label
                  htmlFor="purchase-line-cost"
                  className="mb-1.5 text-xs text-muted-foreground"
                >
                  {allowZeroUnitCost ? "تكلفة (اختياري)" : "تكلفة"}
                  {importsEnabled && docCurrency !== currency
                    ? ` (${docCurrency})`
                    : ""}
                  {selectedProduct
                    ? ` / ${formatUnit(selectedHasPacking ? entryUnit : selectedBaseUnit)}`
                    : ""}
                </Label>
                <Input
                  id="purchase-line-cost"
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  className="min-h-11 tabular-nums"
                  value={unitCost}
                  onChange={(e) => setUnitCost(sanitizeDecimalInput(e.target.value))}
                  placeholder={
                    allowZeroUnitCost
                      ? "بدون سعر"
                      : suggestedEntryCost > 0
                        ? String(suggestedEntryCost)
                        : "آخر تكلفة"
                  }
                />
              </div>
              <div>
                <Label
                  htmlFor="purchase-line-discount"
                  className="mb-1.5 text-xs text-muted-foreground"
                >
                  خصم البند
                </Label>
                <Input
                  id="purchase-line-discount"
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  className="min-h-11 tabular-nums"
                  value={lineDiscount}
                  onChange={(e) => setLineDiscount(sanitizeDecimalInput(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div className="flex items-end">
                <CompactAction
                  label="إضافة"
                  icon={Plus}
                  variant="default"
                  type="submit"
                  disabled={!selectedProductId && !barcode.trim()}
                />
              </div>
            </form>
            {entryPreview ? (
              <p className="text-xs text-muted-foreground">
                يتحوّل للمخزون: {entryPreview.quantity} {formatUnit(selectedBaseUnit)} ×{" "}
                {formatCurrency(entryPreview.unitCost, currency)} ={" "}
                {formatCurrency(entryPreview.lineTotal, currency)}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>رقم التشغيلة</Label>
                <Input
                  className="min-h-11"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="اختياري"
                />
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ الإنتاج</Label>
                <Input
                  className="min-h-11"
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ الانتهاء</Label>
                <Input
                  className="min-h-11"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>صلاحية محسوبة</Label>
                <Input
                  className="min-h-11"
                  value={calculatedExpiryDate ?? "-"}
                  readOnly
                />
              </div>
            </div>
            </div>
            </>
          ) : null}

          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">الأصناف ({invoice.lines.length})</h3>
              {invoice.lines.length > 0 ? (
                <p className="text-xs text-muted-foreground tabular-nums sm:text-sm">
                  إجمالي البنود: {formatCurrency(invoice.total || subtotal, currency)}
                </p>
              ) : null}
            </div>

            {invoice.lines.length === 0 ? (
              <EmptyStateBlock
                title="مفيش أصناف في الفاتورة"
                description={
                  isDraft
                    ? "امسح باركود أو اختَر منتج من فوق عشان تضيف بند."
                    : "الفاتورة بدون بنود."
                }
              />
            ) : (
              <>
                <div className="grid gap-3 md:hidden">
                  {invoice.lines.map((line) => renderLineEditor(line))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المنتج</TableHead>
                        <TableHead className="text-right">الكمية</TableHead>
                        <TableHead className="text-right">تكلفة الوحدة</TableHead>
                        <TableHead className="text-right">خصم</TableHead>
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
                                      line.expiry_date ?? null,
                                      line.discount_amount ?? 0
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
                                      line.expiry_date ?? null,
                                      line.discount_amount ?? 0
                                    )
                                  }
                                />
                              ) : (
                                formatCurrency(line.unit_cost, currency)
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isDraft ? (
                                <DraftDecimalInput
                                  className="ml-auto w-24"
                                  value={line.discount_amount ?? 0}
                                  emptyFallback={0}
                                  onCommit={(discount) =>
                                    updateLine(
                                      line.id,
                                      line.quantity,
                                      line.unit_cost,
                                      line.batch_number ?? null,
                                      line.production_date ?? null,
                                      line.expiry_date ?? null,
                                      discount
                                    )
                                  }
                                />
                              ) : (
                                formatCurrency(line.discount_amount ?? 0, currency)
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
              </>
            )}
          </div>

          {importsEnabled &&
          documentKind === "purchase_order" &&
          invoice &&
          !isLocalDraftId(invoice.id) ? (
            <div className="space-y-3 border-t border-border/60 pt-4">
              <h3 className="text-sm font-semibold">الحاويات</h3>
              {containersLoaded && poContainers.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {poContainers.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span className="tabular-nums">{c.container_number}</span>
                      <span className="text-muted-foreground">{c.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  لسه مفيش حاويات على الأمر ده
                </p>
              )}
              <CreateContainerInline
                purchaseOrderId={invoice.id}
                lines={invoice.lines.map((line) => {
                  const used = poContainers
                    .filter((c) => c.status !== "cancelled")
                    .flatMap((c) => c.lines)
                    .filter((l) => l.source_line_id === line.id)
                    .reduce((s, l) => s + l.quantity, 0);
                  return {
                    sourceLineId: line.id,
                    productName: productMap.get(line.product_id)?.name ?? line.product_id,
                    remaining: Math.max(0, line.quantity - used),
                  };
                })}
                onCreated={(container) =>
                  setPoContainers((prev) => [container, ...prev])
                }
              />
            </div>
          ) : null}
        </div>
      </OperationalCard>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur-xl md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pt-3 lg:ps-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0 shrink">
            <p className="text-xs text-muted-foreground sm:text-sm">{invoice.lines.length} بند</p>
            <p className="truncate text-lg font-semibold tabular-nums sm:text-2xl">
              {formatCurrency(invoice.total || subtotal, currency)}
            </p>
            {isDraft ? <OperatorShortcutHint className="mt-0.5" /> : null}
          </div>
          <CompactActions>
            <CompactAction
              label={
                invoice.status === "cancelled"
                  ? "رجوع"
                  : isDraft
                    ? "حفظ مؤقت"
                    : "إغلاق"
              }
              icon={isDraft ? Save : X}
              shortcut={isDraft ? OPERATOR_SHORTCUTS.save : undefined}
              onClick={() => {
                if (!isDraft) {
                  onComplete();
                  return;
                }
                void (async () => {
                  if (isLocalDraft) {
                    if (invoice.lines.length === 0) {
                      onComplete();
                      return;
                    }
                    const persisted = await ensurePersistedDraft();
                    if (!persisted) return;
                  }
                  toast.success("تم الحفظ المؤقت — تابع لاحقًا من القائمة");
                  onComplete();
                })();
              }}
            />
            {isDraft ? (
              <>
                <CompactAction
                  label="حذف"
                  icon={Trash2}
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                />
                {isPurchaseInvoice ? (
                <>
                <CompactAction
                  label="استدعاء أمر توريد"
                  icon={FileText}
                  disabled={pending}
                  onClick={() => {
                    void openImportPurchaseOrders();
                  }}
                />
                <CompactAction
                  label="حفظ نهائي وتحديث المخزون"
                  icon={PackageCheck}
                  variant="default"
                  disabled={invoice.lines.length === 0}
                  onClick={() => {
                    setAmountPaidNow("0");
                    setReceivePaymentMethod("cash");
                    setConfirmReceive(true);
                  }}
                />
                </>
                ) : null}
                {isPurchaseRequest ? (
                <CompactAction
                  label="تقديم الطلب"
                  icon={Send}
                  variant="default"
                  disabled={invoice.lines.length === 0}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await transitionPurchaseDocumentAction({
                        invoiceId: invoice.id,
                        from: "draft",
                        to: "submitted",
                      });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setInvoice(result.data);
                      toast.success("اتقدم طلب الشراء");
                    });
                  }}
                />
                ) : null}
                {isPurchaseOrder ? (
                <CompactAction
                  label="إرسال أمر التوريد"
                  icon={Send}
                  variant="default"
                  disabled={invoice.lines.length === 0 || !invoice.supplier_id}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await transitionPurchaseDocumentAction({
                        invoiceId: invoice.id,
                        from: "draft",
                        to: "sent",
                      });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setInvoice(result.data);
                      toast.success("اتبعت أمر التوريد");
                    });
                  }}
                />
                ) : null}
                {isPurchaseReturn ? (
                <CompactAction
                  label="ترحيل المرتجع"
                  icon={PackageCheck}
                  variant="default"
                  disabled={invoice.lines.length === 0}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await postPurchaseReturnAction(invoice.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setInvoice(result.data);
                      toast.success("تم ترحيل المرتجع — نزل المخزون ورصيد المورد");
                    });
                  }}
                />
                ) : null}
              </>
            ) : null}
            {isPurchaseRequest && invoice.status === "submitted" ? (
              <>
                <CompactAction
                  label="اعتماد"
                  icon={PackageCheck}
                  variant="default"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await transitionPurchaseDocumentAction({
                        invoiceId: invoice.id,
                        from: "submitted",
                        to: "approved",
                      });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setInvoice(result.data);
                      toast.success("تم اعتماد الطلب");
                    });
                  }}
                />
                <CompactAction
                  label="رفض"
                  icon={Trash2}
                  variant="destructive"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await transitionPurchaseDocumentAction({
                        invoiceId: invoice.id,
                        from: "submitted",
                        to: "rejected",
                      });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setInvoice(result.data);
                      toast.success("اترفض الطلب");
                    });
                  }}
                />
              </>
            ) : null}
            {isPurchaseRequest && invoice.status === "approved" ? (
              <CompactAction
                label="تحويل لأمر توريد"
                icon={FileText}
                variant="default"
                disabled={!invoice.supplier_id}
                onClick={() => {
                  startTransition(async () => {
                    const result = await convertPurchaseDocumentAction({
                      sourceId: invoice.id,
                      targetKind: "purchase_order",
                      fromStatus: "approved",
                      lockStatus: "invoiced",
                    });
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("اتفتح أمر توريد من الطلب");
                    router.push(`/inventory/purchase-orders?invoice=${result.data.id}`);
                  });
                }}
              />
            ) : null}
            {isPurchaseOrder &&
            (invoice.status === "sent" || invoice.status === "partial_invoiced") ? (
              <CompactAction
                label="استلام جزئي / فاتورة شراء"
                icon={FileText}
                variant="default"
                onClick={() => {
                  startTransition(async () => {
                    const result = await previewPurchaseConvertAction(invoice.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    setConvertRows(
                      result.data
                        .filter((row) => row.remaining > 0)
                        .map((row) => ({
                          sourceLineId: row.sourceLineId,
                          productId: row.productId,
                          remaining: row.remaining,
                          qty: String(row.remaining),
                        }))
                    );
                    setConvertOpen(true);
                  });
                }}
              />
            ) : null}
            {invoice.lines.length > 0 ? (
              <>
                <CompactAction
                  label="طباعة A4"
                  icon={FileText}
                  onClick={() =>
                    setPrintPreview({
                      href: `/print/purchases/${invoice.id}?embed=1`,
                      title:
                        COMMERCIAL_DOCUMENT_KIND_LABELS[
                          kind === "purchase_request" ||
                          kind === "purchase_order" ||
                          kind === "purchase_invoice" ||
                          kind === "purchase_return"
                            ? kind
                            : "purchase_invoice"
                        ],
                    })
                  }
                />
                {isPurchaseOrder || isPurchaseRequest ? (
                  <CompactAction
                    label="طباعة بدون أسعار"
                    icon={FileText}
                    onClick={() =>
                      setPrintPreview({
                        href: `/print/purchases/${invoice.id}?embed=1&hidePrices=1`,
                        title: `${kindTitle} بدون أسعار`,
                      })
                    }
                  />
                ) : null}
                {isPurchaseInvoice ? (
                <CompactAction
                  label="ريسيت"
                  icon={Receipt}
                  className="border-primary text-primary"
                  onClick={() =>
                    setPrintPreview({
                      href: `/print/purchases/${invoice.id}/receipt?embed=1`,
                      title: isDraft ? "ريسيت مشتريات مؤقت" : "ريسيت مشتريات",
                    })
                  }
                />
                ) : null}
                <CompactAction
                  label="واتساب"
                  icon={MessageCircle}
                  disabled={!invoice.supplierContact}
                  onClick={() => {
                    const url = buildWhatsAppDocumentUrl(
                      invoice.supplierContact,
                      formatCommercialDocumentForWhatsApp({
                        title:
                          COMMERCIAL_DOCUMENT_KIND_LABELS[
                            kind === "purchase_request" ||
                            kind === "purchase_order" ||
                            kind === "purchase_invoice" ||
                            kind === "purchase_return"
                              ? kind
                              : "purchase_invoice"
                          ],
                        number: invoice.invoice_number,
                        partyName: invoice.supplierName,
                        total: invoice.total,
                        currency,
                        lines: invoice.lines.map((line) => ({
                          name: products.find((p) => p.id === line.product_id)?.name ?? "صنف",
                          quantity: line.quantity,
                          lineTotal: line.line_total,
                        })),
                      })
                    );
                    if (!url) {
                      toast.error("رقم المورد غير صالح لواتساب");
                      return;
                    }
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                />
              </>
            ) : null}
            {isReceived && isPurchaseInvoice ? (
              <>
                <CompactAction
                  label="مرتجع مشتريات"
                  icon={Undo2}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await convertPurchaseDocumentAction({
                        sourceId: invoice.id,
                        targetKind: "purchase_return",
                        fromStatus: "received",
                      });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("اتفتح مرتجع من الفاتورة");
                      router.push(`/inventory/purchase-returns?invoice=${result.data.id}`);
                    });
                  }}
                />
                <CompactAction
                  label="إنشاء قائمة أسعار البيع"
                  icon={Tags}
                  variant="default"
                  href={`/inventory/purchases/price-list?invoice=${invoice.id}`}
                />
                <CompactAction
                  label="إلغاء الاستلام"
                  icon={Undo2}
                  onClick={() => setConfirmVoid(true)}
                />
              </>
            ) : null}
            {canManagePrintEngine ? (
              <CompactAction
                label="تعديل القالب"
                icon={Settings}
                href="/settings?tab=print"
              />
            ) : null}
          </CompactActions>
        </div>
      </div>

      <DocumentPrintPreviewModal
        open={Boolean(printPreview)}
        onOpenChange={(open) => {
          if (!open) setPrintPreview(null);
        }}
        href={printPreview?.href ?? null}
        title={printPreview?.title}
      />

      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف مسودة الشراء؟"
        description="سيتم حذف الفاتورة وبنودها نهائيًا. المخزون لم يتم تحديثه بعد."
        confirmLabel="حذف"
        destructive
        onConfirm={handleDeleteDraft}
      />

      <Dialog open={confirmReceive} onOpenChange={setConfirmReceive}>
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
            <Button variant="outline" onClick={() => setConfirmReceive(false)}>
              إلغاء
            </Button>
            <Button onClick={handleReceive}>تأكيد وتحديث المخزون</Button>
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

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>استلام جزئي من أمر التوريد</DialogTitle>
            <DialogDescription>
              حدّد الكمية اللي هتتحوّل لفاتورة شراء. المتبقي يفضل على الأمر.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[50vh] gap-3 overflow-y-auto">
            {convertRows.map((row) => (
              <div key={row.sourceLineId} className="grid grid-cols-[1fr_7rem] items-end gap-2">
                <div className="space-y-1">
                  <Label>
                    {products.find((p) => p.id === row.productId)?.name ?? "صنف"}
                  </Label>
                  <p className="text-xs text-muted-foreground">المتبقي {row.remaining}</p>
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={row.qty}
                  onChange={(e) => {
                    const next = sanitizeDecimalInput(e.target.value);
                    setConvertRows((current) =>
                      current.map((line) =>
                        line.sourceLineId === row.sourceLineId ? { ...line, qty: next } : line
                      )
                    );
                  }}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConvertOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              disabled={pending || convertRows.length === 0}
              onClick={() => {
                if (!invoice) return;
                const lines = convertRows
                  .map((row) => ({
                    sourceLineId: row.sourceLineId,
                    quantity: Number(row.qty) || 0,
                  }))
                  .filter((row) => row.quantity > 0);
                if (lines.length === 0) {
                  toast.error("اختار كمية واحدة على الأقل");
                  return;
                }
                startTransition(async () => {
                  const result = await convertPurchaseDocumentAction({
                    sourceId: invoice.id,
                    targetKind: "purchase_invoice",
                    fromStatus: invoice.status,
                    lockStatus: "partial_invoiced",
                    lines,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setConvertOpen(false);
                  toast.success("اتفتحت فاتورة شراء من أمر التوريد");
                  router.push(`/inventory/purchases?invoice=${result.data.id}`);
                });
              }}
            >
              إنشاء فاتورة الشراء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            setImportableOrders([]);
            setSelectedImportIds([]);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>استدعاء أوامر توريد</DialogTitle>
            <DialogDescription>
              اختار أوامر مُرسلة (أو فوترة جزئية) لنفس المورد والمخزن. بعد الاستيراد تقدر تعدّل الكمية والسعر على الفاتورة.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[50vh] gap-2 overflow-y-auto">
            {importLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">جاري التحميل…</p>
            ) : importableOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                مفيش أوامر توريد متاحة للاستيراد
              </p>
            ) : (
              importableOrders.map((order) => {
                const selected = selectedImportIds.includes(order.id);
                return (
                  <button
                    key={order.id}
                    type="button"
                    className={`rounded-[var(--mds-radius-lg)] border px-3 py-2 text-start transition-colors ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:bg-muted/40"
                    }`}
                    onClick={() => {
                      setSelectedImportIds((current) =>
                        selected
                          ? current.filter((id) => id !== order.id)
                          : [...current, order.id]
                      );
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{order.invoice_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {statusLabels[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {order.remainingLines} بند متبقي · كمية {order.remainingQty}
                      {order.supplierName ? ` · ${order.supplierName}` : ""}
                    </p>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              disabled={pending || importLoading || selectedImportIds.length === 0}
              onClick={() => {
                if (!invoice) return;
                startTransition(async () => {
                  let targetId = invoice.id;
                  if (isLocalDraftId(targetId)) {
                    const persisted = await ensurePersistedDraft();
                    if (!persisted) return;
                    targetId = persisted.id;
                  }
                  const result = await importPurchaseOrdersIntoInvoiceAction({
                    invoiceId: targetId,
                    sourceIds: selectedImportIds,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setInvoice(result.data);
                  setImportOpen(false);
                  toast.success("اتضافت بنود أوامر التوريد — عدّل السعر لو محتاج");
                });
              }}
            >
              استيراد البنود
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
