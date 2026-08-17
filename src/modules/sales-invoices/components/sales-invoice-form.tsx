"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Plus, Trash2, Save, Send, FileText, Receipt, PackageCheck, Wrench, Loader2, X, MessageCircle, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { OperatorShortcutHint } from "@/components/Velora/operator-shortcut-hint";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { OperationalCard } from "@/components/Velora/operational-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  backgroundMutationKey,
  useBackgroundMutation,
} from "@/hooks/use-background-mutation";
import { useOperatorShortcuts } from "@/hooks/use-operator-shortcuts";
import { useUndoStack } from "@/hooks/use-undo-stack";
import { OPERATOR_SHORTCUTS } from "@/lib/keyboard";
import { formatCurrency } from "@/lib/format";
import { lineTotalAfterDiscount } from "@/lib/line-discount";
import { sanitizeDecimalInput } from "@/lib/digits";
import { PAYMENT_METHODS } from "@/lib/constants";
import { selectLabelById } from "@/lib/select-label";
import type {
  Customer,
  Order,
  PaymentMethod,
  PaymentSplit,
  Product,
  ProductPriceTier,
  Warehouse,
} from "@/lib/types";
import {
  formatUnit,
  productPackingForPricing,
  quantityFromAmount,
} from "@/lib/units";
import { resolveUnitPrice } from "@/modules/products/lib/resolve-unit-price";
import { ProductSearchCombobox } from "@/modules/products/components/product-search-combobox";
import { matchProducts } from "@/modules/products/lib/match-products";
import { computeInvoiceTotals } from "@/modules/sales-invoices/lib/invoice-math";
import { DocumentPrintPreviewModal } from "@/components/print/document-print-preview-modal";
import {
  PosCreditCheckoutDialog,
  type CreditCheckoutConfirm,
} from "@/modules/pos/components/pos-credit-checkout-dialog";
import {
  addSalesInvoiceLineAction,
  convertSalesDocumentAction,
  correctDeliveredSalesInvoiceCostsAction,
  createCreditNoteFromInvoiceAction,
  createSalesInvoiceAction,
  deleteDraftSalesInvoiceAction,
  deliverSalesInvoiceAction,
  importSalesSourcesIntoInvoiceAction,
  issueSalesCreditNoteAction,
  issueSalesInvoiceAction,
  listImportableSalesSourcesAction,
  removeSalesInvoiceLineAction,
  transitionSalesDocumentAction,
  updateSalesInvoiceHeaderAction,
  updateSalesInvoiceLineAction,
} from "@/modules/sales-invoices/actions/sales-invoice.actions";
import {
  buildWhatsAppDocumentUrl,
  formatCommercialDocumentForWhatsApp,
} from "@/modules/pos/services/receipt-format.service";
import { COMMERCIAL_DOCUMENT_KIND_LABELS } from "@/modules/print-engine/lib/print-engine-settings";
import type {
  ImportableSalesSource,
  SalesInvoiceLineWithName,
  SalesInvoiceWithDetails,
} from "@/modules/sales-invoices/services/sales-invoice.service";

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "نقدي",
  card: "بطاقة",
  wallet: "محفظة",
  other: "أخرى",
  credit: "آجل",
};

interface SalesInvoiceFormProps {
  invoice: SalesInvoiceWithDetails;
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  wholesaleTiersByProductId: Record<string, ProductPriceTier[]>;
  currency: string;
  enabledPaymentMethods: PaymentMethod[];
  canCorrectCosts?: boolean;
  canManagePrintEngine?: boolean;
  documentKind?: NonNullable<Order["document_kind"]>;
  onChanged: (invoice: SalesInvoiceWithDetails | null, options?: { refresh?: boolean }) => void;
  onClose: () => void;
}

const LOCAL_DRAFT_PREFIX = "local-";

function isLocalDraftId(id: string) {
  return id.startsWith(LOCAL_DRAFT_PREFIX);
}

function wholesalePriceFor(
  product: Product,
  quantity: number,
  tiersByProduct: Record<string, ProductPriceTier[]>
): { unitPrice: number; tierId: string | null } {
  const tiers = tiersByProduct[product.id] ?? [];
  const resolved = resolveUnitPrice({
    basePrice: product.base_price,
    quantity,
    saleUnit: product.sale_unit ?? product.unit,
    saleMode: "wholesale",
    autoApplyWholesale: false,
    tiers,
    packing: productPackingForPricing(product),
  });
  return { unitPrice: resolved.unitPrice, tierId: resolved.tierId };
}

function resolveAmountEntry(
  product: Product,
  amountValue: number,
  typedPrice: number | undefined,
  isPriceManual: boolean,
  tiersByProduct: Record<string, ProductPriceTier[]>
): { quantity: number; unitPrice: number } | null {
  if (amountValue <= 0) return null;

  let price =
    typedPrice != null && Number.isFinite(typedPrice) && typedPrice > 0
      ? typedPrice
      : wholesalePriceFor(product, 1, tiersByProduct).unitPrice;

  if (price <= 0) return null;

  let quantity = quantityFromAmount(amountValue, price);

  // One pass: tier may depend on weight — recalc qty so الإجمالي ≈ المبلغ.
  if (!isPriceManual) {
    const tiered = wholesalePriceFor(product, quantity, tiersByProduct);
    if (tiered.unitPrice > 0) {
      price = tiered.unitPrice;
      quantity = quantityFromAmount(amountValue, price);
    }
  }

  if (quantity <= 0) return null;
  return { quantity, unitPrice: price };
}

function inferTaxRate(invoice: SalesInvoiceWithDetails): number {
  const taxable = Math.max(0, invoice.subtotal - invoice.discount);
  if (taxable <= 0) return 0;
  const rate = invoice.tax / taxable;
  return Number.isFinite(rate) && rate >= 0 ? rate : 0;
}

function withInvoiceTotals(
  invoice: SalesInvoiceWithDetails,
  lines: SalesInvoiceLineWithName[],
  discount: number,
  taxRate: number
): SalesInvoiceWithDetails {
  const totals = computeInvoiceTotals({ lines, discount, taxRate });
  return {
    ...invoice,
    lines,
    discount: totals.discount,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
  };
}

function SalesInvoiceFormEditor({
  invoice: initial,
  customers,
  products,
  warehouses,
  wholesaleTiersByProductId,
  currency,
  enabledPaymentMethods,
  canCorrectCosts = false,
  canManagePrintEngine = false,
  documentKind = "sales_invoice",
  onChanged,
  onClose,
}: SalesInvoiceFormProps) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initial);
  const [productQuery, setProductQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [amount, setAmount] = useState("");
  const [entryMode, setEntryMode] = useState<"by_qty" | "by_amount">("by_qty");
  const [unitPrice, setUnitPrice] = useState("");
  const [lineDiscount, setLineDiscount] = useState("");
  const [priceManual, setPriceManual] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "unpaid">("cash");
  const [lifecyclePending, startLifecycle] = useTransition();
  const { run: runBackground } = useBackgroundMutation();
  const [confirmDeliver, setConfirmDeliver] = useState(false);
  const [creditDeliverOpen, setCreditDeliverOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCorrectCosts, setConfirmCorrectCosts] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importableSources, setImportableSources] = useState<ImportableSalesSource[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [printPreview, setPrintPreview] = useState<{
    href: string;
    title: string;
  } | null>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const snapshotRef = useRef<SalesInvoiceWithDetails | null>(null);
  const taxRateRef = useRef(inferTaxRate(initial));
  const invoiceRef = useRef(invoice);
  const persistPromiseRef = useRef<Promise<SalesInvoiceWithDetails | null> | null>(null);
  const isUndoingRef = useRef(false);
  const cancelledTempIdsRef = useRef(new Set<string>());
  const removeLineRef = useRef<(lineId: string) => void>(() => {});
  const updateLineRef = useRef<
    (
      lineId: string,
      quantity: number,
      options: { unitPrice?: number; repriceFromTiers?: boolean; discountAmount?: number }
    ) => void
  >(() => {});
  const { push: pushUndo, undo: undoLast, clear: clearUndo } = useUndoStack();
  invoiceRef.current = invoice;

  useEffect(() => {
    // Don't clobber optimistic temp lines with a stale parent snapshot mid-sync.
    setInvoice((current) => {
      if (current.lines.some((line) => line.id.startsWith("temp-"))) return current;
      return initial;
    });
    taxRateRef.current = inferTaxRate(initial);
  }, [initial]);

  const isDraft = invoice.document_status === "draft";
  const isIssued = invoice.document_status === "issued";
  const isDelivered = invoice.document_status === "delivered";
  const kind = invoice.document_kind ?? documentKind;
  const isSalesInvoice = kind === "sales_invoice";
  const isQuotation = kind === "quotation";
  const isSalesOrder = kind === "sales_order";
  const isCreditNote = kind === "credit_note";
  const kindLabels: Record<string, string> = {
    quotation: "عرض سعر",
    sales_order: "أمر بيع",
    sales_invoice: "فاتورة بيع",
    credit_note: "إشعار دائن",
  };
  const statusLabels: Record<string, string> = {
    draft: "مسودة",
    issued: "صادرة",
    delivered: "مُسلَّمة",
    sent: "مُرسل",
    accepted: "مقبول",
    rejected: "مرفوض",
    expired: "منتهي",
    confirmed: "مؤكد",
    cancelled: "ملغي",
    invoiced: "مفوتر",
  };

  const editable = isDraft && !lifecyclePending;
  const recordedCost = useMemo(
    () => invoice.lines.reduce((sum, line) => sum + (Number(line.line_cost) || 0), 0),
    [invoice.lines]
  );

  const productOptions = useMemo(
    () => products.filter((p) => p.is_active),
    [products]
  );
  const productMap = useMemo(
    () => new Map(productOptions.map((p) => [p.id, p])),
    [productOptions]
  );

  const selectedProduct = productId ? productMap.get(productId) : undefined;
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === invoice.customer_id) ?? null,
    [customers, invoice.customer_id]
  );
  const allowAmountEntry = selectedProduct?.supports_amount_sale === true;
  const amountPreview = useMemo(() => {
    if (!allowAmountEntry || entryMode !== "by_amount" || !selectedProduct) {
      return null;
    }
    const amountValue = parseFloat(sanitizeDecimalInput(amount)) || 0;
    const priceRaw = sanitizeDecimalInput(unitPrice);
    const typedPrice = priceRaw ? parseFloat(priceRaw) : undefined;
    const resolved = resolveAmountEntry(
      selectedProduct,
      amountValue,
      typedPrice,
      priceManual,
      wholesaleTiersByProductId
    );
    if (!resolved) return null;
    const unitLabel = formatUnit(selectedProduct.sale_unit ?? selectedProduct.unit);
    return {
      quantity: resolved.quantity,
      unitPrice: resolved.unitPrice,
      label: `${resolved.quantity.toFixed(3)} ${unitLabel}`,
    };
  }, [
    allowAmountEntry,
    entryMode,
    selectedProduct,
    amount,
    unitPrice,
    priceManual,
    wholesaleTiersByProductId,
  ]);

  function publishLocal(next: SalesInvoiceWithDetails) {
    setInvoice(next);
    onChanged(next, { refresh: false });
  }

  const ensurePersistedDraft = useCallback(async (): Promise<SalesInvoiceWithDetails | null> => {
    const current = invoiceRef.current;
    if (!isLocalDraftId(current.id)) return current;
    if (!current.warehouse_id) {
      toast.error("اختار المخزن");
      return null;
    }
    if (persistPromiseRef.current) return persistPromiseRef.current;

    persistPromiseRef.current = (async () => {
      const result = await createSalesInvoiceAction({
        warehouseId: current.warehouse_id!,
        customerId: current.customer_id,
        documentDate: current.document_date,
        documentKind: current.document_kind ?? documentKind,
      });
      if (!result.ok) {
        toast.error(result.error);
        return null;
      }
      const persisted: SalesInvoiceWithDetails = {
        ...result.data,
        lines: [],
        customerName:
          current.customer_id == null
            ? null
            : customers.find((c) => c.id === current.customer_id)?.name ??
              result.data.customerName,
        warehouseName:
          warehouses.find((w) => w.id === current.warehouse_id)?.name ??
          result.data.warehouseName,
        document_notes: current.document_notes,
        discount: current.discount,
        valid_until: current.valid_until,
      };
      setInvoice(persisted);
      invoiceRef.current = persisted;
      onChanged(persisted, { refresh: false });
      return persisted;
    })();

    try {
      return await persistPromiseRef.current;
    } finally {
      persistPromiseRef.current = null;
    }
  }, [customers, warehouses, documentKind, onChanged]);

  const openImportSalesSources = async () => {
    if (!isDraft || !isSalesInvoice) return;
    const persisted = await ensurePersistedDraft();
    if (!persisted) return;
    setImportLoading(true);
    setImportOpen(true);
    setSelectedImportId(null);
    const result = await listImportableSalesSourcesAction({
      customerId: persisted.customer_id,
      warehouseId: persisted.warehouse_id,
    });
    setImportLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      setImportOpen(false);
      return;
    }
    setImportableSources(result.data);
  };

  function runDeliver(payments?: PaymentSplit[]) {
    const method =
      paymentMethod === "unpaid"
        ? null
        : payments?.some((p) => p.method === "credit")
          ? "credit"
          : paymentMethod === "credit"
            ? "credit"
            : paymentMethod;
    const orderId = invoice.id;
    const hasDeposit = Boolean(
      payments?.some((p) => p.method !== "credit" && p.amount > 0) &&
        payments?.some((p) => p.method === "credit")
    );

    onChanged(invoice, { refresh: false });
    onClose();

    runBackground({
      key: backgroundMutationKey("sales", "deliver", orderId),
      label: "جاري تسليم الفاتورة…",
      execute: async () => {
        const result = await deliverSalesInvoiceAction({
          orderId,
          paymentMethod: method,
          payments,
        });
        if (!result.ok) throw new Error(result.error);
        return result.data;
      },
      successMessage: hasDeposit
        ? "تم التسليم مع تسجيل الدفعة والباقي آجل"
        : "تم التسليم وخصم المخزون",
      onSuccess: (data) => {
        onChanged(data, { refresh: true });
      },
    });
  }

  function handleCreditDeliverConfirm({ payments }: CreditCheckoutConfirm) {
    setCreditDeliverOpen(false);
    runDeliver(payments);
  }

  function publishServer(next: SalesInvoiceWithDetails) {
    taxRateRef.current = inferTaxRate(next) || taxRateRef.current;
    setInvoice(next);
    onChanged(next, { refresh: false });
  }

  function applyTierPrice(product: Product, quantityRaw: string) {
    const quantity = parseFloat(sanitizeDecimalInput(quantityRaw)) || 0;
    if (quantity <= 0) {
      setUnitPrice("");
      return;
    }
    const { unitPrice: next } = wholesalePriceFor(product, quantity, wholesaleTiersByProductId);
    setUnitPrice(String(next));
    setPriceManual(false);
  }

  function selectProduct(product: Product) {
    setProductId(product.id);
    setProductQuery(product.name);
    setHighlightIndex(0);
    const nextMode =
      product.supports_amount_sale === true ? "by_amount" : "by_qty";
    setEntryMode(nextMode);
    if (nextMode === "by_amount") {
      setAmount("");
      // Seed unit price from a 1-unit wholesale resolve; qty is derived from amount later.
      applyTierPrice(product, "1");
      setTimeout(() => {
        amountRef.current?.focus();
        amountRef.current?.select();
      }, 50);
      return;
    }
    applyTierPrice(product, qty);
    setTimeout(() => {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }, 50);
  }

  function lookupExactProduct(code: string): Product | undefined {
    const normalized = code.trim().toLowerCase();
    if (!normalized) return undefined;
    return productOptions.find(
      (p) => p.barcode?.toLowerCase() === normalized || p.sku?.toLowerCase() === normalized
    );
  }

  function commitHeader(patch: {
    customerId?: string | null;
    warehouseId?: string;
    discount?: number;
    documentDate?: string;
    documentNotes?: string;
    validUntil?: string | null;
  }) {
    snapshotRef.current = invoice;
    const customerId =
      patch.customerId !== undefined ? patch.customerId : invoice.customer_id;
    const warehouseId =
      patch.warehouseId !== undefined ? patch.warehouseId : invoice.warehouse_id;
    const discount = patch.discount !== undefined ? patch.discount : invoice.discount;
    const documentDate =
      patch.documentDate !== undefined
        ? patch.documentDate
        : (invoice.document_date ?? invoice.created_at.slice(0, 10));
    const documentNotes =
      patch.documentNotes !== undefined ? patch.documentNotes : (invoice.document_notes ?? "");
    const validUntil =
      patch.validUntil !== undefined ? patch.validUntil : (invoice.valid_until ?? null);
    const optimistic = withInvoiceTotals(
      {
        ...invoice,
        customer_id: customerId,
        warehouse_id: warehouseId,
        document_date: documentDate,
        document_notes: documentNotes,
        valid_until: validUntil,
        customerName:
          customerId == null
            ? null
            : customers.find((c) => c.id === customerId)?.name ?? invoice.customerName,
        warehouseName:
          warehouseId == null
            ? null
            : warehouses.find((w) => w.id === warehouseId)?.name ?? invoice.warehouseName,
      },
      invoice.lines,
      discount,
      taxRateRef.current
    );
    publishLocal(optimistic);

    void (async () => {
      const persisted = await ensurePersistedDraft();
      if (!persisted) {
        if (snapshotRef.current) publishLocal(snapshotRef.current);
        return;
      }
      const result = await updateSalesInvoiceHeaderAction({
        orderId: persisted.id,
        ...patch,
      });
      if (!result.ok) {
        if (snapshotRef.current) publishLocal(snapshotRef.current);
        toast.error(result.error);
        return;
      }
      publishServer(result.data);
    })();
  }

  function resetLineInputs() {
    setQty("1");
    setAmount("");
    setEntryMode("by_qty");
    setUnitPrice("");
    setLineDiscount("");
    setPriceManual(false);
    setProductId("");
    setProductQuery("");
    setHighlightIndex(0);
    setTimeout(() => productSearchRef.current?.focus(), 50);
  }

  function addLine(overrideProductId?: string) {
    const resolvedId = overrideProductId || productId;
    if (!resolvedId) {
      toast.error("اختار صنف أو امسح باركود");
      return;
    }
    const product = productMap.get(resolvedId);
    if (!product) {
      toast.error("الصنف غير موجود");
      return;
    }
    const priceRaw = sanitizeDecimalInput(unitPrice);
    const typedPrice = priceRaw ? parseFloat(priceRaw) : undefined;
    if (typedPrice != null && (!Number.isFinite(typedPrice) || typedPrice < 0)) {
      toast.error("سعر غير صالح");
      return;
    }

    const useAmount =
      entryMode === "by_amount" && product.supports_amount_sale === true;
    let quantity = 0;
    let lockedUnitPrice: number | undefined;
    // Capture flags before resetLineInputs clears them.
    let sendManualPrice = priceManual && typedPrice != null;

    if (useAmount) {
      const amountValue = parseFloat(sanitizeDecimalInput(amount)) || 0;
      const resolved = resolveAmountEntry(
        product,
        amountValue,
        typedPrice,
        priceManual,
        wholesaleTiersByProductId
      );
      if (!resolved) {
        toast.error(
          amountValue <= 0
            ? "المبلغ لازم يكون أكبر من صفر"
            : "سعر الوحدة لازم يكون أكبر من صفر عشان نحدد الكمية"
        );
        return;
      }
      quantity = resolved.quantity;
      lockedUnitPrice = resolved.unitPrice;
      // Lock price so line total stays ≈ المبلغ اللي العميل طلبه.
      sendManualPrice = true;
    } else {
      quantity = parseFloat(sanitizeDecimalInput(qty)) || 0;
      if (quantity <= 0) {
        toast.error("الكمية لازم تكون أكبر من صفر");
        return;
      }
    }

    // Same product → bump qty on one row (collapse local duplicates too).
    const sameProductLines = invoice.lines.filter(
      (line) =>
        line.product_id === resolvedId && (line.variant_id ?? null) === null
    );
    const existingLine = sameProductLines[0] ?? null;
    const priorQty = sameProductLines.reduce((sum, line) => sum + line.quantity, 0);
    const mergedQty = Number(((existingLine ? priorQty : 0) + quantity).toFixed(4));
    const tiered = wholesalePriceFor(product, mergedQty, wholesaleTiersByProductId);
    const nextUnitPrice = sendManualPrice
      ? (lockedUnitPrice ?? typedPrice ?? tiered.unitPrice)
      : tiered.unitPrice;
    const addDiscount = Math.max(0, parseFloat(sanitizeDecimalInput(lineDiscount)) || 0);
    const nextDiscount = Number(
      (((existingLine?.discount_amount ?? 0) + addDiscount)).toFixed(2)
    );
    const lineTotal = lineTotalAfterDiscount(mergedQty, nextUnitPrice, nextDiscount);
    const tempId = existingLine ? null : `temp-${crypto.randomUUID()}`;
    const optimisticId = existingLine?.id ?? tempId!;

    const optimisticLine: SalesInvoiceLineWithName = {
      id: optimisticId,
      order_id: invoice.id,
      product_id: resolvedId,
      variant_id: null,
      quantity: mergedQty,
      unit_price: nextUnitPrice,
      list_unit_price: nextUnitPrice,
      discount_amount: nextDiscount,
      promotion_rule_id: null,
      modifiers: [],
      line_total: lineTotal,
      unit_cost: 0,
      line_cost: 0,
      sale_unit: product.sale_unit ?? product.unit,
      base_quantity: mergedQty,
      sale_input_mode: null,
      tier_id: sendManualPrice ? null : tiered.tierId,
      wholesale_applied: true,
      line_note: null,
      productName: product.name,
    };

    const nextLines = existingLine
      ? [
          ...invoice.lines.filter(
            (line) =>
              !(
                line.product_id === resolvedId &&
                (line.variant_id ?? null) === null
              )
          ),
          optimisticLine,
        ]
      : [...invoice.lines, optimisticLine];

    snapshotRef.current = invoice;
    publishLocal(
      withInvoiceTotals(invoice, nextLines, invoice.discount, taxRateRef.current)
    );
    resetLineInputs();

    if (!isUndoingRef.current) {
      const merged = Boolean(existingLine);
      const qtyBeforeAdd = priorQty;
      const priorUnitPrice = existingLine?.unit_price ?? nextUnitPrice;
      const productIdForUndo = resolvedId;
      pushUndo({
        undo: () => {
          const current = invoiceRef.current;
          const line = current.lines.find(
            (l) => l.product_id === productIdForUndo && (l.variant_id ?? null) === null
          );
          if (!line) return;
          isUndoingRef.current = true;
          if (!merged || qtyBeforeAdd <= 0) {
            removeLineRef.current(line.id);
          } else {
            updateLineRef.current(line.id, qtyBeforeAdd, {
              unitPrice: priorUnitPrice,
            });
          }
          isUndoingRef.current = false;
        },
      });
    }

    void (async () => {
      const persisted = await ensurePersistedDraft();
      if (!persisted) {
        if (snapshotRef.current) publishLocal(snapshotRef.current);
        return;
      }
      const result = await addSalesInvoiceLineAction({
        orderId: persisted.id,
        productId: resolvedId,
        quantity,
        discountAmount: addDiscount,
        // Only lock price when operator typed/amount-entry; else server resolves for merged qty.
        ...(sendManualPrice
          ? { unitPrice: nextUnitPrice, tierId: null }
          : {}),
      });
      if (!result.ok) {
        if (snapshotRef.current) publishLocal(snapshotRef.current);
        toast.error(result.error);
        return;
      }
      if (tempId && cancelledTempIdsRef.current.has(tempId)) {
        cancelledTempIdsRef.current.delete(tempId);
        void removeSalesInvoiceLineAction({
          orderId: persisted.id,
          lineId: result.data.line.id,
        });
        return;
      }
      setInvoice((prev) => {
        const serverLine = result.data.line;
        const withoutDupes = prev.lines.filter(
          (line) =>
            line.id !== tempId &&
            line.id !== serverLine.id &&
            !(
              line.product_id === serverLine.product_id &&
              (line.variant_id ?? null) === null
            )
        );
        const next = {
          ...prev,
          id: persisted.id,
          order_number: persisted.order_number,
          lines: [...withoutDupes, serverLine],
          subtotal: result.data.subtotal,
          discount: result.data.discount,
          tax: result.data.tax,
          total: result.data.total,
        };
        taxRateRef.current = inferTaxRate(next) || taxRateRef.current;
        onChanged(next, { refresh: false });
        return next;
      });
    })();
  }

  function updateLine(
    lineId: string,
    quantity: number,
    options: { unitPrice?: number; repriceFromTiers?: boolean; discountAmount?: number }
  ) {
    if (lineId.startsWith("temp-")) return;
    const existing = invoice.lines.find((line) => line.id === lineId);
    if (!existing) return;

    const reprice = options.repriceFromTiers === true || options.unitPrice === undefined;
    snapshotRef.current = invoice;

    let nextUnitPrice = options.unitPrice ?? existing.unit_price;
    let nextTierId = existing.tier_id;
    if (reprice) {
      const product = productMap.get(existing.product_id);
      if (product) {
        const tiered = wholesalePriceFor(product, quantity, wholesaleTiersByProductId);
        nextUnitPrice = tiered.unitPrice;
        nextTierId = tiered.tierId;
      }
    }

    const nextDiscount = Math.max(
      0,
      options.discountAmount !== undefined
        ? options.discountAmount
        : (existing.discount_amount ?? 0)
    );
    const lineTotal = lineTotalAfterDiscount(quantity, nextUnitPrice, nextDiscount);
    const nextLines = invoice.lines.map((line) =>
      line.id === lineId
        ? {
            ...line,
            quantity,
            unit_price: nextUnitPrice,
            discount_amount: nextDiscount,
            list_unit_price: nextUnitPrice,
            line_total: lineTotal,
            base_quantity: quantity,
            tier_id: nextTierId,
          }
        : line
    );
    publishLocal(withInvoiceTotals(invoice, nextLines, invoice.discount, taxRateRef.current));

    void (async () => {
      const result = await updateSalesInvoiceLineAction({
        orderId: invoice.id,
        lineId,
        quantity,
        discountAmount: nextDiscount,
        ...(reprice
          ? { repriceFromTiers: true }
          : { unitPrice: nextUnitPrice, repriceFromTiers: false }),
      });
      if (!result.ok) {
        if (snapshotRef.current) publishLocal(snapshotRef.current);
        toast.error(result.error);
        return;
      }
      setInvoice((prev) => {
        const lines = prev.lines.map((line) =>
          line.id === lineId ? result.data.line : line
        );
        const next = {
          ...prev,
          lines,
          subtotal: result.data.subtotal,
          discount: result.data.discount,
          tax: result.data.tax,
          total: result.data.total,
        };
        onChanged(next, { refresh: false });
        return next;
      });
    })();
  }

  function removeLine(lineId: string) {
    const removed = invoice.lines.find((line) => line.id === lineId);
    if (!removed) return;

    snapshotRef.current = invoice;
    const nextLines = invoice.lines.filter((line) => line.id !== lineId);
    publishLocal(withInvoiceTotals(invoice, nextLines, invoice.discount, taxRateRef.current));

    if (!isUndoingRef.current) {
      const productIdForUndo = removed.product_id;
      const qtyForUndo = removed.quantity;
      const priceForUndo = removed.unit_price;
      pushUndo({
        undo: () => {
          // Re-add by temporarily setting product + qty then calling addLine path via action.
          isUndoingRef.current = true;
          void (async () => {
            const result = await addSalesInvoiceLineAction({
              orderId: invoiceRef.current.id,
              productId: productIdForUndo,
              quantity: qtyForUndo,
              unitPrice: priceForUndo,
              tierId: null,
            });
            isUndoingRef.current = false;
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setInvoice((prev) => {
              const next = {
                ...prev,
                lines: [
                  ...prev.lines.filter(
                    (line) =>
                      !(
                        line.product_id === result.data.line.product_id &&
                        (line.variant_id ?? null) === null
                      )
                  ),
                  result.data.line,
                ],
                subtotal: result.data.subtotal,
                discount: result.data.discount,
                tax: result.data.tax,
                total: result.data.total,
              };
              onChanged(next, { refresh: false });
              return next;
            });
          })();
        },
      });
    }

    if (lineId.startsWith("temp-")) {
      cancelledTempIdsRef.current.add(lineId);
      return;
    }

    void (async () => {
      const result = await removeSalesInvoiceLineAction({
        orderId: invoice.id,
        lineId,
      });
      if (!result.ok) {
        if (snapshotRef.current) publishLocal(snapshotRef.current);
        toast.error(result.error);
        return;
      }
      setInvoice((prev) => {
        const next = {
          ...prev,
          lines: prev.lines.filter((line) => line.id !== lineId),
          subtotal: result.data.subtotal,
          discount: result.data.discount,
          tax: result.data.tax,
          total: result.data.total,
        };
        onChanged(next, { refresh: false });
        return next;
      });
    })();
  }

  removeLineRef.current = removeLine;
  updateLineRef.current = updateLine;

  useOperatorShortcuts({
    enabled: isDraft && !lifecyclePending,
    onSave: () => {
      if (!isDraft || lifecyclePending) return;
      toast.success("تم الحفظ المؤقت — تابع لاحقًا من القائمة");
      onChanged(invoice, { refresh: true });
      onClose();
    },
    onDelete: () => {
      if (!isDraft || lifecyclePending || invoice.lines.length === 0) return;
      const last = invoice.lines[invoice.lines.length - 1];
      if (last) removeLine(last.id);
    },
    onUndo: () => {
      if (!undoLast()) toast.message("مفيش خطوة للتراجع");
    },
  });

  function handleProductSubmit(e: FormEvent) {
    e.preventDefault();
    const exact = lookupExactProduct(productQuery);
    if (exact) {
      if (productId === exact.id) {
        addLine(exact.id);
        return;
      }
      selectProduct(exact);
      return;
    }
    if (productId) {
      addLine(productId);
      return;
    }
    const searchMatches = matchProducts(productOptions, productQuery);
    if (searchMatches.length === 1) {
      selectProduct(searchMatches[0]);
      return;
    }
    if (searchMatches.length > 1) {
      selectProduct(searchMatches[highlightIndex] ?? searchMatches[0]);
      return;
    }
    toast.error("مفيش صنف مطابق");
  }

  return (
    <>
    <OperationalCard
      accent="var(--mds-color-action-primary)"
      className="pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{invoice.order_number}</h2>
          <p className="text-sm text-muted-foreground">
            {kindLabels[kind] ?? "مستند مبيعات"} ·{" "}
            {statusLabels[invoice.document_status ?? "draft"] ?? invoice.document_status}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor={`invoice-date-${invoice.id}`}>
              {isQuotation ? "تاريخ العرض" : "تاريخ المستند"}
            </Label>
            <Input
              id={`invoice-date-${invoice.id}`}
              type="date"
              disabled={!editable}
              max={new Date().toISOString().slice(0, 10)}
              value={invoice.document_date ?? invoice.created_at.slice(0, 10)}
              onChange={(e) => {
                const next = e.target.value;
                if (!next || next === (invoice.document_date ?? invoice.created_at.slice(0, 10))) {
                  return;
                }
                commitHeader({ documentDate: next });
              }}
            />
          </div>
          {isQuotation ? (
            <div className="space-y-1.5">
              <Label htmlFor={`invoice-valid-${invoice.id}`}>صالح حتى</Label>
              <Input
                id={`invoice-valid-${invoice.id}`}
                type="date"
                disabled={!editable}
                value={invoice.valid_until ?? ""}
                onChange={(e) => {
                  const next = e.target.value || null;
                  if (next === (invoice.valid_until ?? null)) return;
                  commitHeader({ validUntil: next });
                }}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor={`invoice-customer-${invoice.id}`}>العميل</Label>
            <Select
              value={invoice.customer_id ?? "__none__"}
              disabled={!editable}
              onValueChange={(v) =>
                commitHeader({ customerId: !v || v === "__none__" ? null : v })
              }
            >
              <SelectTrigger id={`invoice-customer-${invoice.id}`}>
                <SelectValue placeholder="بدون عميل">
                  {(value) =>
                    value === "__none__"
                      ? "بدون عميل"
                      : selectLabelById(customers, value, (c) => c.name)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" label="بدون عميل">
                  بدون عميل
                </SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id} label={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`invoice-warehouse-${invoice.id}`}>المخزن</Label>
            <Select
              value={invoice.warehouse_id ?? ""}
              disabled={!editable}
              onValueChange={(v) => {
                if (v) commitHeader({ warehouseId: v });
              }}
            >
              <SelectTrigger id={`invoice-warehouse-${invoice.id}`}>
                <SelectValue placeholder="المخزن">
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
          <div className="space-y-1.5">
            <Label htmlFor={`invoice-discount-${invoice.id}`}>خصم</Label>
            <Input
              id={`invoice-discount-${invoice.id}`}
              type="text"
              inputMode="decimal"
              disabled={!editable}
              defaultValue={String(invoice.discount)}
              key={`discount-${invoice.id}-${invoice.discount}`}
              onBlur={(e) => {
                const next = parseFloat(sanitizeDecimalInput(e.target.value)) || 0;
                if (next !== invoice.discount) commitHeader({ discount: next });
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`invoice-notes-${invoice.id}`}>ملاحظات المستند</Label>
          <Textarea
            id={`invoice-notes-${invoice.id}`}
            disabled={!editable}
            defaultValue={invoice.document_notes ?? ""}
            key={`notes-${invoice.id}-${invoice.document_notes ?? ""}`}
            rows={2}
            onBlur={(e) => {
              const next = e.target.value;
              if (next !== (invoice.document_notes ?? "")) {
                commitHeader({ documentNotes: next });
              }
            }}
          />
        </div>

        {isDraft ? (
          <form
            onSubmit={handleProductSubmit}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_6rem_7rem_5.5rem_auto] sm:items-end"
          >
            <div>
              <ProductSearchCombobox
                products={productOptions}
                value={productQuery}
                onChange={(value) => {
                  setProductQuery(value);
                  setHighlightIndex(0);
                  if (productId) {
                    const selected = productMap.get(productId);
                    if (selected && value !== selected.name) {
                      setProductId("");
                      setEntryMode("by_qty");
                    }
                  }
                }}
                onSelect={selectProduct}
                onHighlightChange={setHighlightIndex}
                selectedProductId={productId}
                currency={currency}
                inputRef={productSearchRef}
              />
              {allowAmountEntry ? (
                <div className="mt-1.5 inline-flex rounded-lg border p-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={entryMode === "by_qty" ? "default" : "ghost"}
                    className="h-7 rounded-md px-2.5 text-xs"
                    onClick={() => {
                      setEntryMode("by_qty");
                      setTimeout(() => {
                        qtyRef.current?.focus();
                        qtyRef.current?.select();
                      }, 50);
                    }}
                  >
                    بالكمية
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={entryMode === "by_amount" ? "default" : "ghost"}
                    className="h-7 rounded-md px-2.5 text-xs"
                    onClick={() => {
                      setEntryMode("by_amount");
                      setTimeout(() => {
                        amountRef.current?.focus();
                        amountRef.current?.select();
                      }, 50);
                    }}
                  >
                    بالمبلغ
                  </Button>
                </div>
              ) : null}
              {amountPreview ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  الكمية المحسوبة: {amountPreview.label}
                </p>
              ) : null}
            </div>
            {allowAmountEntry && entryMode === "by_amount" ? (
              <div>
                <Label htmlFor={`invoice-line-amount-${invoice.id}`} className="mb-1.5 text-xs text-muted-foreground">مبلغ</Label>
                <Input
                  id={`invoice-line-amount-${invoice.id}`}
                  ref={amountRef}
                  value={amount}
                  onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
                  placeholder="مبلغ"
                  inputMode="decimal"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor={`invoice-line-quantity-${invoice.id}`} className="mb-1.5 text-xs text-muted-foreground">كمية</Label>
                <Input
                  id={`invoice-line-quantity-${invoice.id}`}
                  ref={qtyRef}
                  value={qty}
                  onChange={(e) => {
                    const nextQty = sanitizeDecimalInput(e.target.value);
                    setQty(nextQty);
                    if (priceManual) return;
                    const product = productId ? productMap.get(productId) : undefined;
                    if (product) applyTierPrice(product, nextQty);
                  }}
                  placeholder="كمية"
                  inputMode="decimal"
                />
              </div>
            )}
            <div>
              <Label htmlFor={`invoice-line-price-${invoice.id}`} className="mb-1.5 text-xs text-muted-foreground">سعر جملة</Label>
              <Input
                id={`invoice-line-price-${invoice.id}`}
                value={unitPrice}
                onChange={(e) => {
                  setUnitPrice(sanitizeDecimalInput(e.target.value));
                  setPriceManual(true);
                }}
                placeholder="فاضي = شريحة جملة"
                inputMode="decimal"
              />
            </div>
            <div>
              <Label htmlFor={`invoice-line-discount-${invoice.id}`} className="mb-1.5 text-xs text-muted-foreground">خصم البند</Label>
              <Input
                id={`invoice-line-discount-${invoice.id}`}
                value={lineDiscount}
                onChange={(e) => setLineDiscount(sanitizeDecimalInput(e.target.value))}
                placeholder="0"
                inputMode="decimal"
                className="tabular-nums"
              />
            </div>
            <div className="flex items-end">
              <CompactAction
                label="إضافة"
                icon={Plus}
                variant="default"
                type="submit"
                disabled={lifecyclePending}
              />
            </div>
          </form>
        ) : null}

        {invoice.lines.length === 0 ? (
          <EmptyStateBlock title="مفيش أصناف على الفاتورة" />
        ) : (
          <ResponsiveListLayout
            mobile={invoice.lines.map((line) => {
              const lineLocked = lifecyclePending || line.id.startsWith("temp-");
              return (
                <MobileEntityCard
                  key={line.id}
                  title={line.productName}
                  fields={[
                    {
                      label: "الإجمالي",
                      value: (
                        <span className="tabular-nums">
                          {formatCurrency(line.line_total, currency)}
                        </span>
                      ),
                    },
                  ]}
                  footer={
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`mobile-line-quantity-${line.id}`} className="text-xs text-muted-foreground">كمية</Label>
                          {isDraft ? (
                            <Input
                              id={`mobile-line-quantity-${line.id}`}
                              className="h-11 min-w-0 tabular-nums"
                              value={String(line.quantity)}
                              disabled={lineLocked}
                              onChange={(e) => {
                                const quantity =
                                  parseFloat(sanitizeDecimalInput(e.target.value)) || 0;
                                if (quantity <= 0) return;
                                const product = productMap.get(line.product_id);
                                if (!product) return;
                                const tiered = wholesalePriceFor(
                                  product,
                                  quantity,
                                  wholesaleTiersByProductId
                                );
                                const lineTotal = lineTotalAfterDiscount(
                                  quantity,
                                  tiered.unitPrice,
                                  line.discount_amount ?? 0
                                );
                                const nextLines = invoice.lines.map((row) =>
                                  row.id === line.id
                                    ? {
                                        ...row,
                                        quantity,
                                        unit_price: tiered.unitPrice,
                                        list_unit_price: tiered.unitPrice,
                                        line_total: lineTotal,
                                        base_quantity: quantity,
                                        tier_id: tiered.tierId,
                                      }
                                    : row
                                );
                                publishLocal(
                                  withInvoiceTotals(
                                    invoice,
                                    nextLines,
                                    invoice.discount,
                                    taxRateRef.current
                                  )
                                );
                              }}
                              onBlur={(e) => {
                                const quantity =
                                  parseFloat(sanitizeDecimalInput(e.target.value)) ||
                                  line.quantity;
                                if (quantity <= 0) return;
                                updateLine(line.id, quantity, {
                                  repriceFromTiers: true,
                                  discountAmount: line.discount_amount ?? 0,
                                });
                              }}
                            />
                          ) : (
                            <p className="flex h-11 items-center tabular-nums font-medium">
                              {line.quantity}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`mobile-line-price-${line.id}`} className="text-xs text-muted-foreground">سعر</Label>
                          {isDraft ? (
                            <Input
                              id={`mobile-line-price-${line.id}`}
                              className="h-11 min-w-0 tabular-nums"
                              value={String(line.unit_price)}
                              disabled={lineLocked}
                              onChange={(e) => {
                                const price = parseFloat(
                                  sanitizeDecimalInput(e.target.value)
                                );
                                if (!Number.isFinite(price) || price < 0) return;
                                const lineTotal = lineTotalAfterDiscount(
                                  line.quantity,
                                  price,
                                  line.discount_amount ?? 0
                                );
                                const nextLines = invoice.lines.map((row) =>
                                  row.id === line.id
                                    ? {
                                        ...row,
                                        unit_price: price,
                                        list_unit_price: price,
                                        line_total: lineTotal,
                                        tier_id: null,
                                      }
                                    : row
                                );
                                publishLocal(
                                  withInvoiceTotals(
                                    invoice,
                                    nextLines,
                                    invoice.discount,
                                    taxRateRef.current
                                  )
                                );
                              }}
                              onBlur={(e) => {
                                const price =
                                  parseFloat(sanitizeDecimalInput(e.target.value)) ||
                                  line.unit_price;
                                updateLine(line.id, line.quantity, {
                                  unitPrice: price,
                                  repriceFromTiers: false,
                                  discountAmount: line.discount_amount ?? 0,
                                });
                              }}
                            />
                          ) : (
                            <p className="flex h-11 items-center tabular-nums font-medium">
                              {formatCurrency(line.unit_price, currency)}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`mobile-line-discount-${line.id}`} className="text-xs text-muted-foreground">خصم</Label>
                          {isDraft ? (
                            <Input
                              id={`mobile-line-discount-${line.id}`}
                              className="h-11 min-w-0 tabular-nums"
                              value={String(line.discount_amount ?? 0)}
                              disabled={lineLocked}
                              onChange={(e) => {
                                const discount = Math.max(
                                  0,
                                  parseFloat(sanitizeDecimalInput(e.target.value)) || 0
                                );
                                const lineTotal = lineTotalAfterDiscount(
                                  line.quantity,
                                  line.unit_price,
                                  discount
                                );
                                const nextLines = invoice.lines.map((row) =>
                                  row.id === line.id
                                    ? {
                                        ...row,
                                        discount_amount: discount,
                                        line_total: lineTotal,
                                      }
                                    : row
                                );
                                publishLocal(
                                  withInvoiceTotals(
                                    invoice,
                                    nextLines,
                                    invoice.discount,
                                    taxRateRef.current
                                  )
                                );
                              }}
                              onBlur={(e) => {
                                const discount = Math.max(
                                  0,
                                  parseFloat(sanitizeDecimalInput(e.target.value)) || 0
                                );
                                updateLine(line.id, line.quantity, {
                                  unitPrice: line.unit_price,
                                  repriceFromTiers: false,
                                  discountAmount: discount,
                                });
                              }}
                            />
                          ) : (
                            <p className="flex h-11 items-center tabular-nums font-medium">
                              {formatCurrency(line.discount_amount ?? 0, currency)}
                            </p>
                          )}
                        </div>
                      </div>
                      {isDraft ? (
                        <CompactActions className="w-full justify-end">
                          <CompactAction
                            label="حذف البند"
                            icon={Trash2}
                            variant="destructive"
                            disabled={lifecyclePending}
                            onClick={() => removeLine(line.id)}
                          />
                        </CompactActions>
                      ) : null}
                    </div>
                  }
                />
              );
            })}
            desktop={
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الصنف</TableHead>
                      <TableHead>كمية</TableHead>
                      <TableHead>سعر</TableHead>
                      <TableHead>خصم</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      {isDraft ? <TableHead className="w-12" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.productName}</TableCell>
                        <TableCell>
                          {isDraft ? (
                            <Input
                              className="w-full min-w-0 sm:w-20"
                              value={String(line.quantity)}
                              disabled={lifecyclePending || line.id.startsWith("temp-")}
                              onChange={(e) => {
                                const quantity =
                                  parseFloat(sanitizeDecimalInput(e.target.value)) || 0;
                                if (quantity <= 0) return;
                                const product = productMap.get(line.product_id);
                                if (!product) return;
                                const tiered = wholesalePriceFor(
                                  product,
                                  quantity,
                                  wholesaleTiersByProductId
                                );
                                const lineTotal = lineTotalAfterDiscount(
                                  quantity,
                                  tiered.unitPrice,
                                  line.discount_amount ?? 0
                                );
                                const nextLines = invoice.lines.map((row) =>
                                  row.id === line.id
                                    ? {
                                        ...row,
                                        quantity,
                                        unit_price: tiered.unitPrice,
                                        list_unit_price: tiered.unitPrice,
                                        line_total: lineTotal,
                                        base_quantity: quantity,
                                        tier_id: tiered.tierId,
                                      }
                                    : row
                                );
                                publishLocal(
                                  withInvoiceTotals(
                                    invoice,
                                    nextLines,
                                    invoice.discount,
                                    taxRateRef.current
                                  )
                                );
                              }}
                              onBlur={(e) => {
                                const quantity =
                                  parseFloat(sanitizeDecimalInput(e.target.value)) ||
                                  line.quantity;
                                if (quantity <= 0) return;
                                updateLine(line.id, quantity, {
                                  repriceFromTiers: true,
                                  discountAmount: line.discount_amount ?? 0,
                                });
                              }}
                            />
                          ) : (
                            line.quantity
                          )}
                        </TableCell>
                        <TableCell>
                          {isDraft ? (
                            <Input
                              className="w-24"
                              value={String(line.unit_price)}
                              disabled={lifecyclePending || line.id.startsWith("temp-")}
                              onChange={(e) => {
                                const price = parseFloat(
                                  sanitizeDecimalInput(e.target.value)
                                );
                                if (!Number.isFinite(price) || price < 0) return;
                                const lineTotal = lineTotalAfterDiscount(
                                  line.quantity,
                                  price,
                                  line.discount_amount ?? 0
                                );
                                const nextLines = invoice.lines.map((row) =>
                                  row.id === line.id
                                    ? {
                                        ...row,
                                        unit_price: price,
                                        list_unit_price: price,
                                        line_total: lineTotal,
                                        tier_id: null,
                                      }
                                    : row
                                );
                                publishLocal(
                                  withInvoiceTotals(
                                    invoice,
                                    nextLines,
                                    invoice.discount,
                                    taxRateRef.current
                                  )
                                );
                              }}
                              onBlur={(e) => {
                                const price =
                                  parseFloat(sanitizeDecimalInput(e.target.value)) ||
                                  line.unit_price;
                                updateLine(line.id, line.quantity, {
                                  unitPrice: price,
                                  repriceFromTiers: false,
                                  discountAmount: line.discount_amount ?? 0,
                                });
                              }}
                            />
                          ) : (
                            formatCurrency(line.unit_price, currency)
                          )}
                        </TableCell>
                        <TableCell>
                          {isDraft ? (
                            <Input
                              className="w-20"
                              value={String(line.discount_amount ?? 0)}
                              disabled={lifecyclePending || line.id.startsWith("temp-")}
                              onChange={(e) => {
                                const discount = Math.max(
                                  0,
                                  parseFloat(sanitizeDecimalInput(e.target.value)) || 0
                                );
                                const lineTotal = lineTotalAfterDiscount(
                                  line.quantity,
                                  line.unit_price,
                                  discount
                                );
                                const nextLines = invoice.lines.map((row) =>
                                  row.id === line.id
                                    ? {
                                        ...row,
                                        discount_amount: discount,
                                        line_total: lineTotal,
                                      }
                                    : row
                                );
                                publishLocal(
                                  withInvoiceTotals(
                                    invoice,
                                    nextLines,
                                    invoice.discount,
                                    taxRateRef.current
                                  )
                                );
                              }}
                              onBlur={(e) => {
                                const discount = Math.max(
                                  0,
                                  parseFloat(sanitizeDecimalInput(e.target.value)) || 0
                                );
                                updateLine(line.id, line.quantity, {
                                  unitPrice: line.unit_price,
                                  repriceFromTiers: false,
                                  discountAmount: discount,
                                });
                              }}
                            />
                          ) : (
                            formatCurrency(line.discount_amount ?? 0, currency)
                          )}
                        </TableCell>
                        <TableCell>{formatCurrency(line.line_total, currency)}</TableCell>
                        {isDraft ? (
                          <TableCell>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-11"
                              disabled={lifecyclePending}
                              onClick={() => removeLine(line.id)}
                              aria-label={`حذف ${line.productName} من الفاتورة`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            }
          />
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>الجزئي: {formatCurrency(invoice.subtotal, currency)}</span>
          <span>الخصم: {formatCurrency(invoice.discount, currency)}</span>
          <span>الضريبة: {formatCurrency(invoice.tax, currency)}</span>
        </div>
      </div>
    </OperationalCard>

    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur-xl md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pt-3 lg:ps-64">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="min-w-0 shrink">
          <p className="text-xs text-muted-foreground sm:text-sm">{invoice.lines.length} بند</p>
          <p className="truncate text-lg font-semibold tabular-nums sm:text-2xl">
            {formatCurrency(invoice.total, currency)}
          </p>
          {isDelivered ? (
            <p className="text-xs text-muted-foreground">
              تكلفة مسجّلة: {formatCurrency(recordedCost, currency)}
            </p>
          ) : null}
          {isDraft ? <OperatorShortcutHint className="mt-0.5" /> : null}
        </div>
        <CompactActions>
          {isDraft ? (
            <>
              <CompactAction
                label="حفظ مؤقت"
                icon={Save}
                shortcut={OPERATOR_SHORTCUTS.save}
                disabled={lifecyclePending}
                onClick={() => {
                  void (async () => {
                    if (invoice.lines.some((line) => line.id.startsWith("temp-"))) {
                      toast.error("استنى لحد ما الأصناف تتسجل");
                      return;
                    }
                    if (isLocalDraftId(invoice.id)) {
                      if (invoice.lines.length === 0) {
                        onClose();
                        return;
                      }
                      const persisted = await ensurePersistedDraft();
                      if (!persisted) return;
                    }
                    toast.success("تم الحفظ المؤقت — تابع لاحقًا من القائمة");
                    onChanged(invoiceRef.current, { refresh: true });
                    onClose();
                  })();
                }}
              />
              {isSalesInvoice ? (
                <>
                <CompactAction
                  label="استدعاء عرض سعر"
                  icon={FileText}
                  disabled={lifecyclePending}
                  onClick={() => {
                    void openImportSalesSources();
                  }}
                />
                <CompactAction
                  label="إصدار"
                  icon={Send}
                  variant="default"
                  disabled={
                    lifecyclePending ||
                    invoice.lines.length === 0 ||
                    invoice.lines.some((line) => line.id.startsWith("temp-"))
                  }
                  onClick={() => {
                    void (async () => {
                      const persisted = await ensurePersistedDraft();
                      if (!persisted) return;
                      if (persisted.lines.length === 0) {
                        toast.error("ضيف أصناف قبل الإصدار");
                        return;
                      }
                      if (persisted.lines.some((line) => line.id.startsWith("temp-"))) {
                        toast.error("استنى لحد ما الأصناف تتسجل");
                        return;
                      }
                      const orderId = persisted.id;
                      onClose();
                      runBackground({
                        key: backgroundMutationKey("sales", "issue", orderId),
                        label: "جاري إصدار الفاتورة…",
                        execute: async () => {
                          const result = await issueSalesInvoiceAction(orderId);
                          if (!result.ok) throw new Error(result.error);
                          return result.data;
                        },
                        successMessage: "تم إصدار الفاتورة",
                        onSuccess: (data) => {
                          onChanged(data, { refresh: true });
                        },
                      });
                    })();
                  }}
                />
                </>
              ) : null}
              {isQuotation ? (
                <CompactAction
                  label="إرسال العرض"
                  icon={Send}
                  variant="default"
                  disabled={
                    lifecyclePending ||
                    invoice.lines.length === 0 ||
                    invoice.lines.some((line) => line.id.startsWith("temp-"))
                  }
                  onClick={() => {
                    void (async () => {
                      const persisted = await ensurePersistedDraft();
                      if (!persisted) return;
                      if (persisted.lines.some((line) => line.id.startsWith("temp-"))) {
                        toast.error("استنى لحد ما الأصناف تتسجل");
                        return;
                      }
                      const orderId = persisted.id;
                      runBackground({
                        key: backgroundMutationKey("sales", "send-quote", orderId),
                        label: "جاري إرسال عرض السعر…",
                        execute: async () => {
                          const result = await transitionSalesDocumentAction({
                            orderId,
                            from: "draft",
                            to: "sent",
                          });
                          if (!result.ok) throw new Error(result.error);
                          return result.data;
                        },
                        successMessage: "تم تعليم العرض كمُرسل",
                        onSuccess: (data) => onChanged(data, { refresh: true }),
                      });
                    })();
                  }}
                />
              ) : null}
              {isSalesOrder ? (
                <CompactAction
                  label="تأكيد الأمر"
                  icon={PackageCheck}
                  variant="default"
                  disabled={
                    lifecyclePending ||
                    invoice.lines.length === 0 ||
                    invoice.lines.some((line) => line.id.startsWith("temp-"))
                  }
                  onClick={() => {
                    void (async () => {
                      const persisted = await ensurePersistedDraft();
                      if (!persisted) return;
                      if (persisted.lines.some((line) => line.id.startsWith("temp-"))) {
                        toast.error("استنى لحد ما الأصناف تتسجل");
                        return;
                      }
                      const orderId = persisted.id;
                      runBackground({
                        key: backgroundMutationKey("sales", "confirm-so", orderId),
                        label: "جاري تأكيد أمر البيع…",
                        execute: async () => {
                          const result = await transitionSalesDocumentAction({
                            orderId,
                            from: "draft",
                            to: "confirmed",
                          });
                          if (!result.ok) throw new Error(result.error);
                          return result.data;
                        },
                        successMessage: "تم تأكيد أمر البيع",
                        onSuccess: (data) => onChanged(data, { refresh: true }),
                      });
                    })();
                  }}
                />
              ) : null}
              {isCreditNote ? (
                <CompactAction
                  label="إصدار الإشعار"
                  icon={Send}
                  variant="default"
                  disabled={lifecyclePending || invoice.lines.length === 0}
                  onClick={() => {
                    const orderId = invoice.id;
                    runBackground({
                      key: backgroundMutationKey("sales", "issue-cn", orderId),
                      label: "جاري إصدار الإشعار الدائن…",
                      execute: async () => {
                        const result = await issueSalesCreditNoteAction(orderId);
                        if (!result.ok) throw new Error(result.error);
                        return result.data;
                      },
                      successMessage: "تم إصدار الإشعار — رجع المخزون والرصيد",
                      onSuccess: (data) => onChanged(data, { refresh: true }),
                    });
                  }}
                />
              ) : null}
              <CompactAction
                label="حذف المسودة"
                icon={Trash2}
                variant="destructive"
                disabled={lifecyclePending}
                onClick={() => setConfirmDelete(true)}
              />
            </>
          ) : (
            <CompactAction
              label="إغلاق"
              icon={X}
              disabled={lifecyclePending}
              onClick={onClose}
            />
          )}

          {isQuotation && invoice.document_status === "sent" ? (
            <>
            <CompactAction
              label="تحويل لأمر بيع"
              icon={FileText}
              variant="default"
              disabled={lifecyclePending}
              onClick={() => {
                const orderId = invoice.id;
                runBackground({
                  key: backgroundMutationKey("sales", "quote-to-so", orderId),
                  label: "جاري إنشاء أمر البيع…",
                  execute: async () => {
                    const result = await convertSalesDocumentAction({
                      sourceId: orderId,
                      targetKind: "sales_order",
                      fromStatus: "sent",
                      lockStatus: "accepted",
                    });
                    if (!result.ok) throw new Error(result.error);
                    return result.data;
                  },
                  successMessage: "اتفتح أمر بيع من العرض",
                  onSuccess: (data) => {
                    onChanged(invoice, { refresh: true });
                    router.push(`/sales-orders?open=${data.id}`);
                  },
                });
              }}
            />
            <CompactAction
              label="تحويل لفاتورة"
              icon={FileText}
              variant="default"
              disabled={lifecyclePending}
              onClick={() => {
                const orderId = invoice.id;
                runBackground({
                  key: backgroundMutationKey("sales", "quote-to-si", orderId),
                  label: "جاري إنشاء فاتورة المبيعات…",
                  execute: async () => {
                    const result = await convertSalesDocumentAction({
                      sourceId: orderId,
                      targetKind: "sales_invoice",
                      fromStatus: "sent",
                      lockStatus: "accepted",
                    });
                    if (!result.ok) throw new Error(result.error);
                    return result.data;
                  },
                  successMessage: "اتفتحت فاتورة من عرض السعر",
                  onSuccess: (data) => {
                    onChanged(invoice, { refresh: true });
                    router.push(`/sales-invoices?open=${data.id}`);
                  },
                });
              }}
            />
            <CompactAction
              label="رفض العرض"
              icon={X}
              variant="destructive"
              disabled={lifecyclePending}
              onClick={() => {
                const orderId = invoice.id;
                runBackground({
                  key: backgroundMutationKey("sales", "reject-quote", orderId),
                  label: "جاري رفض عرض السعر…",
                  execute: async () => {
                    const result = await transitionSalesDocumentAction({
                      orderId,
                      from: "sent",
                      to: "rejected",
                    });
                    if (!result.ok) throw new Error(result.error);
                    return result.data;
                  },
                  successMessage: "اترفض عرض السعر",
                  onSuccess: (data) => onChanged(data, { refresh: true }),
                });
              }}
            />
            </>
          ) : null}

          {isSalesOrder && invoice.document_status === "confirmed" ? (
            <CompactAction
              label="تحويل لفاتورة"
              icon={FileText}
              variant="default"
              disabled={lifecyclePending}
              onClick={() => {
                const orderId = invoice.id;
                runBackground({
                  key: backgroundMutationKey("sales", "so-to-si", orderId),
                  label: "جاري إنشاء فاتورة المبيعات…",
                  execute: async () => {
                    const result = await convertSalesDocumentAction({
                      sourceId: orderId,
                      targetKind: "sales_invoice",
                      fromStatus: "confirmed",
                      lockStatus: "invoiced",
                    });
                    if (!result.ok) throw new Error(result.error);
                    return result.data;
                  },
                  successMessage: "اتفتحت فاتورة من أمر البيع",
                  onSuccess: (data) => {
                    onChanged(invoice, { refresh: true });
                    router.push(`/sales-invoices?open=${data.id}`);
                  },
                });
              }}
            />
          ) : null}

          {isIssued && isSalesInvoice ? (
            <>
              <Select
                value={paymentMethod}
                onValueChange={(v) => {
                  if (
                    v === "unpaid" ||
                    v === "cash" ||
                    v === "card" ||
                    v === "wallet" ||
                    v === "other" ||
                    v === "credit"
                  ) {
                    setPaymentMethod(v);
                  }
                }}
              >
                <SelectTrigger className="h-11 w-[min(100%,11rem)] sm:h-9 sm:w-40">
                  <SelectValue placeholder="الدفع">
                    {(value) =>
                      value === "unpaid"
                        ? "بدون تحصيل الآن"
                        : paymentLabels[value as PaymentMethod] ?? "الدفع"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} label={paymentLabels[m]}>
                      {paymentLabels[m]}
                    </SelectItem>
                  ))}
                  <SelectItem value="unpaid" label="بدون تحصيل الآن">
                    بدون تحصيل الآن
                  </SelectItem>
                </SelectContent>
              </Select>
              <CompactAction
                label="تسليم وخصم مخزون"
                icon={PackageCheck}
                variant="default"
                disabled={lifecyclePending}
                onClick={() => {
                  if (paymentMethod === "credit") {
                    if (!invoice.customer_id) {
                      toast.error("اختر عميلًا قبل تسليم فاتورة آجل");
                      return;
                    }
                    setCreditDeliverOpen(true);
                    return;
                  }
                  setConfirmDeliver(true);
                }}
              />
            </>
          ) : null}

          {isDelivered && isSalesInvoice ? (
            <CompactAction
              label="إشعار دائن"
              icon={FileText}
              disabled={lifecyclePending}
              onClick={() => {
                const orderId = invoice.id;
                runBackground({
                  key: backgroundMutationKey("sales", "create-cn", orderId),
                  label: "جاري إنشاء الإشعار الدائن…",
                  execute: async () => {
                    const result = await createCreditNoteFromInvoiceAction(orderId);
                    if (!result.ok) throw new Error(result.error);
                    return result.data;
                  },
                  successMessage: "اتفتح إشعار دائن من الفاتورة",
                  onSuccess: (data) => {
                    router.push(`/credit-notes?open=${data.id}`);
                  },
                });
              }}
            />
          ) : null}

          {isDelivered && canCorrectCosts ? (
            <CompactAction
              label="تصحيح التكلفة"
              icon={Wrench}
              disabled={lifecyclePending || invoice.lines.length === 0}
              onClick={() => setConfirmCorrectCosts(true)}
            />
          ) : null}

          {invoice.lines.length > 0 ? (
            <>
              <CompactAction
                label="طباعة A4"
                icon={FileText}
                onClick={() =>
                  setPrintPreview({
                    href: `/print/orders/${invoice.id}?embed=1`,
                    title:
                      COMMERCIAL_DOCUMENT_KIND_LABELS[
                        kind === "quotation" ||
                        kind === "sales_order" ||
                        kind === "sales_invoice" ||
                        kind === "credit_note"
                          ? kind
                          : "sales_invoice"
                      ],
                  })
                }
              />
              {isQuotation || isSalesOrder ? (
                <CompactAction
                  label="طباعة بدون أسعار"
                  icon={FileText}
                  onClick={() =>
                    setPrintPreview({
                      href: `/print/orders/${invoice.id}?embed=1&hidePrices=1`,
                      title: `${kindLabels[kind ?? "sales_invoice"] ?? "مستند"} بدون أسعار`,
                    })
                  }
                />
              ) : null}
              {isSalesInvoice && (isIssued || isDelivered) ? (
                <CompactAction
                  label="إذن تسليم"
                  icon={PackageCheck}
                  onClick={() =>
                    setPrintPreview({
                      href: `/print/orders/${invoice.id}?embed=1&variant=delivery`,
                      title: COMMERCIAL_DOCUMENT_KIND_LABELS.delivery_note,
                    })
                  }
                />
              ) : null}
              {isSalesInvoice ? (
                <CompactAction
                  label="ريسيت"
                  icon={Receipt}
                  className="border-primary text-primary"
                  onClick={() =>
                    setPrintPreview({
                      href: `/print/receipts/${invoice.id}?embed=1`,
                      title:
                        invoice.document_status === "draft" ? "ريسيت مؤقت" : "ريسيت مبيعات",
                    })
                  }
                />
              ) : null}
              <CompactAction
                label="واتساب"
                icon={MessageCircle}
                disabled={!selectedCustomer?.phone}
                onClick={() => {
                  const url = buildWhatsAppDocumentUrl(
                    selectedCustomer?.phone,
                    formatCommercialDocumentForWhatsApp({
                      title:
                        COMMERCIAL_DOCUMENT_KIND_LABELS[
                          kind === "quotation" ||
                          kind === "sales_order" ||
                          kind === "sales_invoice" ||
                          kind === "credit_note"
                            ? kind
                            : "sales_invoice"
                        ],
                      number: invoice.order_number,
                      partyName: selectedCustomer?.name,
                      total: invoice.total,
                      currency,
                      lines: invoice.lines.map((line) => ({
                        name: line.productName,
                        quantity: line.quantity,
                        lineTotal: line.line_total,
                      })),
                    })
                  );
                  if (!url) {
                    toast.error("رقم هاتف العميل غير صالح لواتساب");
                    return;
                  }
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
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
        open={confirmDeliver}
        onOpenChange={setConfirmDeliver}
        title="تأكيد التسليم"
        description="هيتخصم المخزون ويتقفل مسار الفاتورة. متأكد؟"
        confirmLabel="تسليم"
        onConfirm={() => {
          setConfirmDeliver(false);
          runDeliver(
            paymentMethod === "unpaid"
              ? undefined
              : [{ method: paymentMethod, amount: invoice.total }]
          );
        }}
      />

      <PosCreditCheckoutDialog
        open={creditDeliverOpen}
        onOpenChange={setCreditDeliverOpen}
        total={invoice.total}
        customer={selectedCustomer}
        enabledMethods={enabledPaymentMethods}
        loading={lifecyclePending}
        onConfirm={handleCreditDeliverConfirm}
      />

      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف المسودة"
        description="هتتمسح الفاتورة والأسطر نهائيًا."
        confirmLabel="حذف"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          if (isLocalDraftId(invoice.id)) {
            toast.success("اتمسحت المسودة");
            clearUndo();
            onChanged(null, { refresh: false });
            onClose();
            return;
          }
          startLifecycle(async () => {
            const result = await deleteDraftSalesInvoiceAction(invoice.id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("اتمسحت المسودة");
            clearUndo();
            onChanged(null, { refresh: true });
            onClose();
          });
        }}
      />

      <ConfirmActionDialog
        open={confirmCorrectCosts}
        onOpenChange={setConfirmCorrectCosts}
        title="تصحيح تكلفة الفاتورة"
        description={`هيتطبّق سعر الشراء الحالي للصنف على أسطر الفاتورة المُسلَّمة. المخزون والمدفوعات مش هيتغيّروا. التكلفة المسجّلة دلوقتي: ${formatCurrency(recordedCost, currency)}.`}
        confirmLabel="تطبيق التكلفة"
        onConfirm={() => {
          setConfirmCorrectCosts(false);
          startLifecycle(async () => {
            const result = await correctDeliveredSalesInvoiceCostsAction(invoice.id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            const { invoice: next, correction } = result.data;
            setInvoice(next);
            onChanged(next, { refresh: true });
            if (correction.changedLines === 0) {
              toast.message("مفيش تغيير — التكلفة مطابقة لسعر الشراء الحالي");
              return;
            }
            toast.success(
              `اتصحّحت تكلفة ${correction.changedLines} سطر: ${formatCurrency(correction.previousTotal, currency)} → ${formatCurrency(correction.nextTotal, currency)}`
            );
          });
        }}
      />

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            setImportableSources([]);
            setSelectedImportId(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>استدعاء عرض سعر / أمر بيع</DialogTitle>
            <DialogDescription>
              اختار عرض مُرسل أو أمر مؤكد لنفس العميل والمخزن. بعد الاستيراد تقدر تعدّل الكمية والسعر على الفاتورة.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[50vh] gap-2 overflow-y-auto">
            {importLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">جاري التحميل…</p>
            ) : importableSources.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                مفيش عروض أسعار أو أوامر بيع متاحة
              </p>
            ) : (
              importableSources.map((source) => {
                const selected = selectedImportId === source.id;
                return (
                  <button
                    key={source.id}
                    type="button"
                    className={`rounded-[var(--mds-radius-lg)] border px-3 py-2 text-start transition-colors ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:bg-muted/40"
                    }`}
                    onClick={() => setSelectedImportId(source.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{source.order_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {kindLabels[source.document_kind]} ·{" "}
                        {statusLabels[source.document_status] ?? source.document_status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {source.lineCount} بند · {formatCurrency(source.total, currency)}
                      {source.customerName ? ` · ${source.customerName}` : ""}
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
              disabled={lifecyclePending || importLoading || !selectedImportId}
              onClick={() => {
                if (!selectedImportId) return;
                startLifecycle(async () => {
                  const persisted = await ensurePersistedDraft();
                  if (!persisted) return;
                  const result = await importSalesSourcesIntoInvoiceAction({
                    invoiceId: persisted.id,
                    sourceIds: [selectedImportId],
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setInvoice(result.data);
                  onChanged(result.data, { refresh: true });
                  setImportOpen(false);
                  toast.success("اتضافت البنود — عدّل الكمية أو السعر لو محتاج");
                });
              }}
            >
              استيراد البنود
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SalesInvoiceForm(props: SalesInvoiceFormProps) {
  return <SalesInvoiceFormEditor key={props.invoice.id} {...props} />;
}
