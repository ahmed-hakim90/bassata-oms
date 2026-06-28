"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
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
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import type { Product, Store, Warehouse } from "@/lib/types";
import { selectLabelById } from "@/lib/select-label";
import {
  addTransferLineAction,
  createTransferAction,
  deleteDraftTransferAction,
  getTransferDetailAction,
  receiveTransferAction,
  removeTransferLineAction,
  sendTransferAction,
  updateDraftTransferAction,
  updateTransferLineAction,
  voidTransferAction,
} from "@/modules/transfers/actions/transfer.actions";
import type { TransferWithLines } from "@/modules/transfers/services/transfer.service";

interface TransferFormProps {
  stores: Store[];
  warehouses: Warehouse[];
  products: Product[];
  defaultFromStoreId: string;
  initialTransferId?: string;
  onComplete: () => void;
}

export function TransferForm({
  stores,
  warehouses,
  products,
  defaultFromStoreId,
  initialTransferId,
  onComplete,
}: TransferFormProps) {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(!!initialTransferId);
  const [transfer, setTransfer] = useState<TransferWithLines | null>(null);
  const [fromStoreId, setFromStoreId] = useState(defaultFromStoreId);
  const [toStoreId, setToStoreId] = useState(
    stores.find((s) => s.id !== defaultFromStoreId)?.id ?? ""
  );
  const warehousesForStore = (storeId: string) =>
    warehouses.filter((w) => w.store_id === storeId && w.is_active);
  const defaultWarehouseForStore = (storeId: string) =>
    warehousesForStore(storeId).find((w) => w.is_default)?.id ??
    warehousesForStore(storeId)[0]?.id ??
    "";
  const [fromWarehouseId, setFromWarehouseId] = useState(
    defaultWarehouseForStore(defaultFromStoreId)
  );
  const [toWarehouseId, setToWarehouseId] = useState(
    defaultWarehouseForStore(stores.find((s) => s.id !== defaultFromStoreId)?.id ?? "")
  );
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);

  useEffect(() => {
    if (!initialTransferId) return;
    startTransition(async () => {
      const result = await getTransferDetailAction(initialTransferId);
      setLoading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTransfer(result.data);
      setFromStoreId(result.data.from_store_id);
      setToStoreId(result.data.to_store_id);
      setFromWarehouseId(result.data.from_warehouse_id);
      setToWarehouseId(result.data.to_warehouse_id);
    });
  }, [initialTransferId]);

  const refreshTransfer = (id: string) => {
    startTransition(async () => {
      const result = await getTransferDetailAction(id);
      if (result.ok) setTransfer(result.data);
    });
  };

  const createDraft = () => {
    startTransition(async () => {
      const result = await createTransferAction({
        fromStoreId,
        toStoreId,
        fromWarehouseId,
        toWarehouseId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const t = result.data;
      setTransfer({
        ...t,
        lines: [],
        fromStoreName: stores.find((s) => s.id === fromStoreId)?.name ?? "",
        toStoreName: stores.find((s) => s.id === toStoreId)?.name ?? "",
        fromWarehouseName: warehouses.find((w) => w.id === fromWarehouseId)?.name ?? "",
        toWarehouseName: warehouses.find((w) => w.id === toWarehouseId)?.name ?? "",
      });
      toast.success("تم إنشاء مسودة التحويل");
    });
  };

  const addLine = () => {
    if (!transfer || !productId || quantity <= 0) return;
    startTransition(async () => {
      const result = await addTransferLineAction({
        transferId: transfer.id,
        productId,
        quantity,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      refreshTransfer(transfer.id);
      setProductId("");
      setQuantity(1);
      toast.success("تم إضافة السطر");
    });
  };

  const removeLine = (lineId: string) => {
    if (!transfer) return;
    startTransition(async () => {
      const result = await removeTransferLineAction(lineId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTransfer({
        ...transfer,
        lines: transfer.lines.filter((l) => l.id !== lineId),
      });
    });
  };

  const updateLineQty = (lineId: string, qty: number) => {
    if (!transfer || qty <= 0) return;
    startTransition(async () => {
      const result = await updateTransferLineAction({ lineId, quantity: qty });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTransfer({
        ...transfer,
        lines: transfer.lines.map((l) =>
          l.id === lineId ? { ...l, quantity_sent: qty } : l
        ),
      });
    });
  };

  const send = () => {
    if (!transfer) return;
    startTransition(async () => {
      const result = await sendTransferAction(transfer.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      refreshTransfer(transfer.id);
      toast.success("تم إرسال التحويل");
    });
  };

  const receive = () => {
    if (!transfer) return;
    startTransition(async () => {
      const result = await receiveTransferAction(transfer.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("تم استلام التحويل");
      onComplete();
    });
  };

  const handleDeleteDraft = async () => {
    if (!transfer) return;
    const result = await deleteDraftTransferAction(transfer.id);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success("تم حذف التحويل");
    onComplete();
  };

  const saveStores = () => {
    if (!transfer) return;
    startTransition(async () => {
      const result = await updateDraftTransferAction({
        transferId: transfer.id,
        fromStoreId,
        toStoreId,
        fromWarehouseId,
        toWarehouseId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const from = stores.find((s) => s.id === fromStoreId);
      const to = stores.find((s) => s.id === toStoreId);
      const fromWarehouse = warehouses.find((w) => w.id === fromWarehouseId);
      const toWarehouse = warehouses.find((w) => w.id === toWarehouseId);
      setTransfer({
        ...transfer,
        from_store_id: fromStoreId,
        to_store_id: toStoreId,
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        fromStoreName: from?.name ?? transfer.fromStoreName,
        toStoreName: to?.name ?? transfer.toStoreName,
        fromWarehouseName: fromWarehouse?.name ?? transfer.fromWarehouseName,
        toWarehouseName: toWarehouse?.name ?? transfer.toWarehouseName,
      });
      toast.success("تم تحديث الفروع");
    });
  };

  const handleVoid = async () => {
    if (!transfer) return;
    const result = await voidTransferAction(transfer.id);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success("تم إلغاء التحويل - تم عكس المخزون");
    onComplete();
  };

  if (loading) {
    return (
      <OperationalCard title="جاري تحميل التحويل…">
        <p className="text-sm text-muted-foreground">برجاء الانتظار</p>
      </OperationalCard>
    );
  }

  if (!transfer) {
    return (
      <OperationalCard title="تحويل جديد">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>من فرع</Label>
            <Select
              value={fromStoreId}
              onValueChange={(v) => {
                const next = v ?? "";
                setFromStoreId(next);
                setFromWarehouseId(defaultWarehouseForStore(next));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) => selectLabelById(stores, value, (s) => s.name)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id} label={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fromWarehouseId} onValueChange={(v) => setFromWarehouseId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="من مخزن">
                  {(value) => selectLabelById(warehouses, value, (w) => w.name)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {warehousesForStore(fromStoreId).map((w) => (
                  <SelectItem key={w.id} value={w.id} label={w.name}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>إلى فرع</Label>
            <Select
              value={toStoreId}
              onValueChange={(v) => {
                const next = v ?? "";
                setToStoreId(next);
                setToWarehouseId(defaultWarehouseForStore(next));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) => selectLabelById(stores, value, (s) => s.name)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id} label={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={toWarehouseId} onValueChange={(v) => setToWarehouseId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="إلى مخزن">
                  {(value) => selectLabelById(warehouses, value, (w) => w.name)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {warehousesForStore(toStoreId).map((w) => (
                  <SelectItem key={w.id} value={w.id} label={w.name}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          className="mt-6"
          onClick={createDraft}
          disabled={pending || !fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId}
        >
          إنشاء تحويل
        </Button>
      </OperationalCard>
    );
  }

  const isDraft = transfer.status === "draft";
  const isSent = transfer.status === "sent";
  const isReceived = transfer.status === "received";
  const isCancelled = transfer.status === "cancelled";
  const canVoid = isSent || isReceived;

  return (
    <div className="space-y-6">
      <OperationalCard
        title={`${transfer.fromStoreName} / ${transfer.fromWarehouseName} → ${transfer.toStoreName} / ${transfer.toWarehouseName}`}
        description={`الحالة: ${transfer.status}`}
      >
        {isDraft && (
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>من فرع</Label>
              <Select
                value={fromStoreId}
                onValueChange={(v) => {
                  const next = v ?? "";
                  setFromStoreId(next);
                  setFromWarehouseId(defaultWarehouseForStore(next));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                  {(value) => selectLabelById(stores, value, (s) => s.name)}
                </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id} label={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fromWarehouseId} onValueChange={(v) => setFromWarehouseId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) => selectLabelById(warehouses, value, (w) => w.name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {warehousesForStore(fromStoreId).map((w) => (
                    <SelectItem key={w.id} value={w.id} label={w.name}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>إلى فرع</Label>
              <div className="flex gap-2">
                <Select
                  value={toStoreId}
                  onValueChange={(v) => {
                    const next = v ?? "";
                    setToStoreId(next);
                    setToWarehouseId(defaultWarehouseForStore(next));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                  {(value) => selectLabelById(stores, value, (s) => s.name)}
                </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id} label={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={toWarehouseId} onValueChange={(v) => setToWarehouseId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value) => selectLabelById(warehouses, value, (w) => w.name)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {warehousesForStore(toStoreId).map((w) => (
                      <SelectItem key={w.id} value={w.id} label={w.name}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveStores}
                  disabled={
                    pending ||
                    (fromStoreId === transfer.from_store_id &&
                      toStoreId === transfer.to_store_id &&
                      fromWarehouseId === transfer.from_warehouse_id &&
                      toWarehouseId === transfer.to_warehouse_id)
                  }
                >
                  حفظ
                </Button>
              </div>
            </div>
          </div>
        )}
        {isDraft && (
          <div className="flex flex-wrap gap-2">
            <Select value={productId} onValueChange={(v) => setProductId(v ?? "")}>
              <SelectTrigger className="min-w-48">
                <SelectValue placeholder="المنتج">
                  {(value) => selectLabelById(products, value, (p) => p.name)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id} label={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-24"
            />
            <Button onClick={addLine} disabled={pending || !productId}>
              <Plus className="size-4" /> إضافة
            </Button>
          </div>
        )}
        <ul className="mt-4 space-y-2">
          {transfer.lines.map((line) => (
            <li
              key={line.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/50 px-4 py-2"
            >
              <span>{products.find((p) => p.id === line.product_id)?.name}</span>
              <div className="flex items-center gap-2">
                {isDraft ? (
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    defaultValue={line.quantity_sent}
                    onBlur={(e) => {
                      const qty = parseInt(e.target.value) || 1;
                      if (qty !== line.quantity_sent) updateLineQty(line.id, qty);
                    }}
                  />
                ) : (
                  <span className="font-medium">{line.quantity_sent} وحدة</span>
                )}
                {isDraft && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeLine(line.id)}
                    disabled={pending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          {isDraft && (
            <>
              <Button onClick={send} disabled={pending || transfer.lines.length === 0}>
                إرسال التحويل <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
              >
                حذف المسودة
              </Button>
            </>
          )}
          {isSent && (
            <>
              <Button onClick={receive} disabled={pending}>
                الاستلام في الوجهة
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmVoid(true)}
                disabled={pending}
              >
                إلغاء الإرسال
              </Button>
            </>
          )}
          {canVoid && isReceived && (
            <Button variant="outline" onClick={() => setConfirmVoid(true)} disabled={pending}>
              إلغاء التحويل
            </Button>
          )}
          <Button variant="outline" onClick={onComplete}>
            {isCancelled ? "رجوع" : "تم"}
          </Button>
        </div>
      </OperationalCard>

      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف مسودة التحويل؟"
        description="سيتم حذف التحويل وكل البنود نهائيًا. لم يتم تحريك أي مخزون بعد."
        confirmLabel="حذف"
        destructive
        onConfirm={handleDeleteDraft}
      />

      <ConfirmActionDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        title={isSent ? "إلغاء تحويل مرسل؟" : "إلغاء تحويل مستلم؟"}
        description="سيتم عكس مستويات المخزون لإلغاء هذا التحويل. لا يمكن التراجع عن ذلك."
        confirmLabel="إلغاء وعكس المخزون"
        destructive
        onConfirm={handleVoid}
      />
    </div>
  );
}
