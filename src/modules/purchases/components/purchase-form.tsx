"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Barcode, Plus, Trash2 } from "lucide-react";
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
import { selectLabelById } from "@/lib/select-label";
import { formatUnit } from "@/lib/units";
import type { Product, Supplier, Warehouse } from "@/lib/types";
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
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(!!initialInvoiceId);
  const [invoice, setInvoice] = useState<PurchaseWithLines | null>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ""
  );
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [extraCost, setExtraCost] = useState("0");
  const [barcode, setBarcode] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const productLabel = (p: Product) => `${p.name} · ${formatUnit(p.unit)}`;
  const selectedProduct = selectedProductId ? productMap.get(selectedProductId) : undefined;

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
      setExtraCost(String(result.data.extra_cost ?? 0));
    });
  }, [initialInvoiceId]);

  const refreshInvoice = (id: string) => {
    startTransition(async () => {
      const result = await getPurchaseDetailAction(id);
      if (result.ok) setInvoice(result.data);
    });
  };

  const handleCreateDraft = () => {
    if (!supplierId || !warehouseId || !invoiceNumber.trim()) {
      toast.error("Select supplier, warehouse, and enter invoice number");
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
      toast.success("Draft purchase created");
      setTimeout(() => barcodeRef.current?.focus(), 100);
    });
  };

  const addLine = useCallback(
    (productId: string, qty: number, cost: number) => {
      if (!invoice || qty <= 0 || cost < 0) return;
      startTransition(async () => {
        const result = await addPurchaseLineAction({
          invoiceId: invoice.id,
          productId,
          quantity: qty,
          unitCost: cost,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        refreshInvoice(invoice.id);
        setBarcode("");
        setQuantity(1);
        setUnitCost("");
        setSelectedProductId("");
        barcodeRef.current?.focus();
        toast.success(`Added ${productMap.get(productId)?.name ?? "item"}`);
      });
    },
    [invoice, productMap]
  );

  const lookupBarcode = (code: string) =>
    products.find((p) => p.barcode === code.trim() || p.sku === code.trim());

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = lookupBarcode(barcode);
    if (found) {
      setSelectedProductId(found.id);
      setUnitCost(String(found.base_price * 0.6));
      qtyRef.current?.focus();
      qtyRef.current?.select();
    } else if (selectedProductId) {
      addLine(
        selectedProductId,
        quantity,
        parseFloat(unitCost) || productMap.get(selectedProductId)?.base_price || 0
      );
    } else {
      toast.error("Product not found");
    }
  };

  const handleReceive = () => {
    if (!invoice) return;
    startTransition(async () => {
      const result = await receivePurchaseAction(invoice.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Purchase received — stock updated");
      onComplete();
    });
  };

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
      setInvoice({
        ...invoice,
        ...result.data,
        supplierName: supplier?.name ?? invoice.supplierName,
      });
      toast.success("Invoice updated");
    });
  };

  const updateLine = (lineId: string, qty: number, cost: number) => {
    if (!invoice || qty <= 0 || cost < 0) return;
    startTransition(async () => {
      const result = await updatePurchaseLineAction({ lineId, quantity: qty, unitCost: cost });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      refreshInvoice(invoice.id);
    });
  };

  const removeLine = (lineId: string) => {
    if (!invoice) return;
    startTransition(async () => {
      const result = await removePurchaseLineAction(lineId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInvoice({
        ...invoice,
        lines: invoice.lines.filter((l) => l.id !== lineId),
      });
    });
  };

  const handleDeleteDraft = async () => {
    if (!invoice) return;
    const result = await deleteDraftPurchaseAction(invoice.id);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success("Purchase deleted");
    onComplete();
  };

  const handleVoid = async () => {
    if (!invoice) return;
    const result = await voidPurchaseAction(invoice.id);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success("Purchase voided — stock reversed");
    onComplete();
  };

  if (loading) {
    return (
      <OperationalCard title="Loading purchase…">
        <p className="text-sm text-muted-foreground">Please wait</p>
      </OperationalCard>
    );
  }

  const subtotal = invoice?.lines.reduce((s, l) => s + l.line_total, 0) ?? 0;
  const isDraft = invoice?.status === "draft";
  const isReceived = invoice?.status === "received";

  if (!invoice) {
    return (
      <OperationalCard title="New Purchase Invoice">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select supplier">
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
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={(v) => setWarehouseId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select warehouse">
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
            <Label>Invoice #</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-001"
              onKeyDown={(e) => e.key === "Enter" && handleCreateDraft()}
            />
          </div>
          <div className="space-y-2">
            <Label>Extra cost</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={extraCost}
              onChange={(e) => setExtraCost(e.target.value)}
              placeholder="Freight, duties"
            />
          </div>
        </div>
        <Button className="mt-6" onClick={handleCreateDraft} disabled={pending}>
          Start Draft
        </Button>
      </OperationalCard>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-32">
      <OperationalCard
        title={`Invoice ${invoice.invoice_number}`}
        description={
          isDraft
            ? "Scan barcode or search product — Enter to add"
            : `Status: ${invoice.status} · ${invoice.supplierName} · ${invoice.warehouseName}`
        }
      >
        {isDraft && (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
                  <SelectTrigger className="w-full">
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
                <Label>Warehouse</Label>
                <Select value={warehouseId} disabled>
                  <SelectTrigger className="w-full">
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
                <Label>Invoice #</Label>
                <div className="flex gap-2">
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={saveHeader} disabled={pending}>
                    Save
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Extra cost</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={extraCost}
                  onChange={(e) => setExtraCost(e.target.value)}
                  placeholder="Freight, duties"
                />
              </div>
            </div>
            <form onSubmit={handleBarcodeSubmit} className="grid gap-4 lg:grid-cols-4">
              <div className="space-y-2 lg:col-span-2">
                <Label className="flex items-center gap-2">
                  <Barcode className="size-4" /> Barcode / SKU
                </Label>
                <Input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or type barcode..."
                  autoComplete="off"
                  className="font-mono text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Product</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={(v) => {
                    setSelectedProductId(v ?? "");
                    const p = productMap.get(v ?? "");
                    if (p) setUnitCost(String(p.base_price * 0.6));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Or select...">
                      {(value) => {
                        const p = products.find((x) => x.id === value);
                        return p ? productLabel(p) : "Or select...";
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
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label>
                    Qty{selectedProduct ? ` (${formatUnit(selectedProduct.unit)})` : ""}
                  </Label>
                  <Input
                    ref={qtyRef}
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="lg:col-span-4" disabled={pending}>
                <Plus className="size-4" /> Add Line (Enter)
              </Button>
            </form>
          </>
        )}
      </OperationalCard>

      {invoice.lines.length > 0 && (
        <OperationalCard title="Line Items">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                {!isDraft && <TableHead className="text-right">Landed Cost</TableHead>}
                <TableHead className="text-right">Total</TableHead>
                {isDraft && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((line) => {
                const lineProduct = productMap.get(line.product_id);
                const unit = lineProduct ? formatUnit(lineProduct.unit) : "";
                return (
                <TableRow key={line.id}>
                  <TableCell>
                    {lineProduct?.name ?? line.product_id}
                  </TableCell>
                  <TableCell className="text-right">
                    {isDraft ? (
                      <Input
                        type="number"
                        min={1}
                        className="ml-auto w-20"
                        defaultValue={line.quantity}
                        onBlur={(e) => {
                          const qty = parseInt(e.target.value) || 1;
                          if (qty !== line.quantity || line.unit_cost) {
                            updateLine(line.id, qty, line.unit_cost);
                          }
                        }}
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
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        className="ml-auto w-24"
                        defaultValue={line.unit_cost}
                        onBlur={(e) => {
                          const cost = parseFloat(e.target.value) || 0;
                          if (cost !== line.unit_cost) {
                            updateLine(line.id, line.quantity, cost);
                          }
                        }}
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
                        disabled={pending}
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
        </OperationalCard>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 p-4 backdrop-blur-xl lg:pl-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {invoice.lines.length} line{invoice.lines.length !== 1 ? "s" : ""}
            </p>
            <p className="text-2xl font-semibold">{formatCurrency(subtotal, currency)}</p>
            {invoice.extra_cost > 0 ? (
              <p className="text-xs text-muted-foreground">
                + {formatCurrency(invoice.extra_cost, currency)} landed cost · total{" "}
                {formatCurrency(invoice.total, currency)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onComplete}>
              {invoice.status === "cancelled" ? "Back" : "Close"}
            </Button>
            {isDraft && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={pending}
                >
                  Delete Draft
                </Button>
                <Button
                  onClick={handleReceive}
                  disabled={pending || invoice.lines.length === 0}
                  className="min-w-32"
                >
                  Receive Stock
                </Button>
              </>
            )}
            {isReceived && (
              <Button variant="outline" onClick={() => setConfirmVoid(true)} disabled={pending}>
                Void Receipt
              </Button>
            )}
          </div>
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete draft purchase?"
        description="Permanently removes this invoice and lines. Stock has not been updated yet."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteDraft}
      />

      <ConfirmActionDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        title="Void received purchase?"
        description="Received quantities will be removed from stock. Requires owner or manager."
        confirmLabel="Void & reverse stock"
        destructive
        onConfirm={handleVoid}
      />
    </div>
  );
}
