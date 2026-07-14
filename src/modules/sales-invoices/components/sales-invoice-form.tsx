"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { formatCurrency } from "@/lib/format";
import { sanitizeDecimalInput } from "@/lib/digits";
import { PAYMENT_METHODS } from "@/lib/constants";
import { selectLabelById } from "@/lib/select-label";
import type {
  Customer,
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
  correctDeliveredSalesInvoiceCostsAction,
  deleteDraftSalesInvoiceAction,
  deliverSalesInvoiceAction,
  issueSalesInvoiceAction,
  removeSalesInvoiceLineAction,
  updateSalesInvoiceHeaderAction,
  updateSalesInvoiceLineAction,
} from "@/modules/sales-invoices/actions/sales-invoice.actions";
import type {
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
  onChanged: (invoice: SalesInvoiceWithDetails | null, options?: { refresh?: boolean }) => void;
  onClose: () => void;
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

export function SalesInvoiceForm({
  invoice: initial,
  customers,
  products,
  warehouses,
  wholesaleTiersByProductId,
  currency,
  enabledPaymentMethods,
  canCorrectCosts = false,
  onChanged,
  onClose,
}: SalesInvoiceFormProps) {
  const [invoice, setInvoice] = useState(initial);
  const [productQuery, setProductQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [amount, setAmount] = useState("");
  const [entryMode, setEntryMode] = useState<"by_qty" | "by_amount">("by_qty");
  const [unitPrice, setUnitPrice] = useState("");
  const [priceManual, setPriceManual] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "unpaid">("cash");
  const [lifecyclePending, startLifecycle] = useTransition();
  const [confirmDeliver, setConfirmDeliver] = useState(false);
  const [creditDeliverOpen, setCreditDeliverOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCorrectCosts, setConfirmCorrectCosts] = useState(false);
  const [printPreview, setPrintPreview] = useState<{
    href: string;
    title: string;
  } | null>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const snapshotRef = useRef<SalesInvoiceWithDetails | null>(null);
  const taxRateRef = useRef(inferTaxRate(initial));

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

  function runDeliver(payments?: PaymentSplit[]) {
    startLifecycle(async () => {
      const method =
        paymentMethod === "unpaid"
          ? null
          : payments?.some((p) => p.method === "credit")
            ? "credit"
            : paymentMethod === "credit"
              ? "credit"
              : paymentMethod;
      const result = await deliverSalesInvoiceAction({
        orderId: invoice.id,
        paymentMethod: method,
        payments,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const hasDeposit = Boolean(
        payments?.some((p) => p.method !== "credit" && p.amount > 0) &&
          payments?.some((p) => p.method === "credit")
      );
      toast.success(
        hasDeposit ? "تم التسليم مع تسجيل الدفعة والباقي آجل" : "تم التسليم وخصم المخزون"
      );
      setInvoice(result.data);
      onChanged(result.data, { refresh: true });
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
    const optimistic = withInvoiceTotals(
      {
        ...invoice,
        customer_id: customerId,
        warehouse_id: warehouseId,
        document_date: documentDate,
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
      const result = await updateSalesInvoiceHeaderAction({
        orderId: invoice.id,
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
    const lineTotal = Number((mergedQty * nextUnitPrice).toFixed(2));
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
      discount_amount: 0,
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

    void (async () => {
      const result = await addSalesInvoiceLineAction({
        orderId: invoice.id,
        productId: resolvedId,
        quantity,
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
    options: { unitPrice?: number; repriceFromTiers?: boolean }
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

    const lineTotal = Number((quantity * nextUnitPrice).toFixed(2));
    const nextLines = invoice.lines.map((line) =>
      line.id === lineId
        ? {
            ...line,
            quantity,
            unit_price: nextUnitPrice,
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
    if (lineId.startsWith("temp-")) return;
    snapshotRef.current = invoice;
    const nextLines = invoice.lines.filter((line) => line.id !== lineId);
    publishLocal(withInvoiceTotals(invoice, nextLines, invoice.discount, taxRateRef.current));

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
    <OperationalCard accent="var(--mds-color-action-primary)">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{invoice.order_number}</h2>
            <p className="text-sm text-muted-foreground">
              فاتورة جملة ·{" "}
              {invoice.document_status === "draft"
                ? "مسودة"
                : invoice.document_status === "issued"
                  ? "صادرة"
                  : "مُسلَّمة"}
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            إغلاق
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>تاريخ الفاتورة</Label>
            <Input
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
          <div className="space-y-1.5">
            <Label>العميل</Label>
            <Select
              value={invoice.customer_id ?? "__none__"}
              disabled={!editable}
              onValueChange={(v) =>
                commitHeader({ customerId: !v || v === "__none__" ? null : v })
              }
            >
              <SelectTrigger>
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
            <Label>المخزن</Label>
            <Select
              value={invoice.warehouse_id ?? ""}
              disabled={!editable}
              onValueChange={(v) => {
                if (v) commitHeader({ warehouseId: v });
              }}
            >
              <SelectTrigger>
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
            <Label>خصم</Label>
            <Input
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

        {isDraft ? (
          <form
            onSubmit={handleProductSubmit}
            className="grid gap-2 sm:grid-cols-[1fr_6rem_7rem_auto]"
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
                selectedProductId={productId}
                currency={currency}
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
                <Label className="mb-1.5 text-xs text-muted-foreground">مبلغ</Label>
                <Input
                  ref={amountRef}
                  value={amount}
                  onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
                  placeholder="مبلغ"
                  inputMode="decimal"
                />
              </div>
            ) : (
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">كمية</Label>
                <Input
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
              <Label className="mb-1.5 text-xs text-muted-foreground">سعر جملة</Label>
              <Input
                value={unitPrice}
                onChange={(e) => {
                  setUnitPrice(sanitizeDecimalInput(e.target.value));
                  setPriceManual(true);
                }}
                placeholder="فاضي = شريحة جملة"
                inputMode="decimal"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={lifecyclePending}>
                <Plus className="size-4" />
                إضافة
              </Button>
            </div>
          </form>
        ) : null}

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الصنف</TableHead>
                <TableHead>كمية</TableHead>
                <TableHead>سعر</TableHead>
                <TableHead>الإجمالي</TableHead>
                {isDraft ? <TableHead className="w-12" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isDraft ? 5 : 4} className="text-center text-muted-foreground">
                    مفيش أصناف على الفاتورة
                  </TableCell>
                </TableRow>
              ) : (
                invoice.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.productName}</TableCell>
                    <TableCell>
                      {isDraft ? (
                        <Input
                          className="w-20"
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
                            const lineTotal = Number((quantity * tiered.unitPrice).toFixed(2));
                            const nextLines = invoice.lines.map((row) =>
                              row.id === line.id
                                ? {
                                    ...row,
                                    quantity,
                                    unit_price: tiered.unitPrice,
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
                              parseFloat(sanitizeDecimalInput(e.target.value)) || line.quantity;
                            if (quantity <= 0) return;
                            updateLine(line.id, quantity, { repriceFromTiers: true });
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
                            const price = parseFloat(sanitizeDecimalInput(e.target.value));
                            if (!Number.isFinite(price) || price < 0) return;
                            const lineTotal = Number((line.quantity * price).toFixed(2));
                            const nextLines = invoice.lines.map((row) =>
                              row.id === line.id
                                ? { ...row, unit_price: price, line_total: lineTotal, tier_id: null }
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
                              parseFloat(sanitizeDecimalInput(e.target.value)) || line.unit_price;
                            updateLine(line.id, line.quantity, {
                              unitPrice: price,
                              repriceFromTiers: false,
                            });
                          }}
                        />
                      ) : (
                        formatCurrency(line.unit_price, currency)
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(line.line_total, currency)}</TableCell>
                    {isDraft ? (
                      <TableCell>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={lifecyclePending}
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <span>الجزئي: {formatCurrency(invoice.subtotal, currency)}</span>
          <span>الخصم: {formatCurrency(invoice.discount, currency)}</span>
          <span>الضريبة: {formatCurrency(invoice.tax, currency)}</span>
          <span className="font-semibold">الإجمالي: {formatCurrency(invoice.total, currency)}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={lifecyclePending}
                onClick={() => {
                  toast.success("تم الحفظ المؤقت — تابع لاحقًا من القائمة");
                  onChanged(invoice, { refresh: true });
                  onClose();
                }}
              >
                حفظ مؤقت
              </Button>
              <Button
                type="button"
                disabled={
                  lifecyclePending ||
                  invoice.lines.length === 0 ||
                  invoice.lines.some((line) => line.id.startsWith("temp-"))
                }
                onClick={() =>
                  startLifecycle(async () => {
                    const result = await issueSalesInvoiceAction(invoice.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("تم إصدار الفاتورة");
                    setInvoice(result.data);
                    onChanged(result.data, { refresh: true });
                  })
                }
              >
                إصدار
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={lifecyclePending}
                onClick={() => setConfirmDelete(true)}
              >
                حذف المسودة
              </Button>
            </>
          ) : null}

          {isIssued ? (
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
                <SelectTrigger className="w-40">
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
              <Button
                type="button"
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
              >
                تسليم وخصم مخزون
              </Button>
            </>
          ) : null}

          {isDelivered && canCorrectCosts ? (
            <Button
              type="button"
              variant="outline"
              disabled={lifecyclePending || invoice.lines.length === 0}
              onClick={() => setConfirmCorrectCosts(true)}
            >
              تصحيح التكلفة
            </Button>
          ) : null}

          {isDelivered ? (
            <p className="text-muted-foreground text-xs">
              تكلفة مسجّلة: {formatCurrency(recordedCost, currency)}
            </p>
          ) : null}

          {invoice.lines.length > 0 &&
          (invoice.document_status === "draft" ||
            invoice.document_status === "issued" ||
            invoice.document_status === "delivered") ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() =>
                  setPrintPreview({
                    href: `/print/orders/${invoice.id}?embed=1`,
                    title:
                      invoice.document_status === "draft"
                        ? "فاتورة مؤقتة"
                        : "فاتورة مبيعات",
                  })
                }
              >
                فاتورة
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-primary bg-primary/5 font-medium text-primary"
                onClick={() =>
                  setPrintPreview({
                    href: `/print/receipts/${invoice.id}?embed=1`,
                    title:
                      invoice.document_status === "draft"
                        ? "ريسيت مؤقت"
                        : "ريسيت مبيعات",
                  })
                }
              >
                ريسيت
              </Button>
            </>
          ) : null}
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
          startLifecycle(async () => {
            const result = await deleteDraftSalesInvoiceAction(invoice.id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("اتمسحت المسودة");
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
    </OperationalCard>
  );
}
