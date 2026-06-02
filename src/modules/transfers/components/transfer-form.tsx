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
      toast.success("Transfer draft created");
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
      toast.success("Line added");
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
      toast.success("Transfer sent");
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
      toast.success("Transfer received");
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
    toast.success("Transfer deleted");
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
      toast.success("Stores updated");
    });
  };

  const handleVoid = async () => {
    if (!transfer) return;
    const result = await voidTransferAction(transfer.id);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success("Transfer cancelled — stock reversed");
    onComplete();
  };

  if (loading) {
    return (
      <OperationalCard title="Loading transfer…">
        <p className="text-sm text-muted-foreground">Please wait</p>
      </OperationalCard>
    );
  }

  if (!transfer) {
    return (
      <OperationalCard title="New Transfer">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>From Store</Label>
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
                <SelectValue placeholder="From warehouse">
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
            <Label>To Store</Label>
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
                <SelectValue placeholder="To warehouse">
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
          Create Transfer
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
        description={`Status: ${transfer.status}`}
      >
        {isDraft && (
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From Store</Label>
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
              <Label>To Store</Label>
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
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
        {isDraft && (
          <div className="flex flex-wrap gap-2">
            <Select value={productId} onValueChange={(v) => setProductId(v ?? "")}>
              <SelectTrigger className="min-w-48">
                <SelectValue placeholder="Product">
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
              <Plus className="size-4" /> Add
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
                  <span className="font-medium">{line.quantity_sent} units</span>
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
                Send Transfer <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
              >
                Delete Draft
              </Button>
            </>
          )}
          {isSent && (
            <>
              <Button onClick={receive} disabled={pending}>
                Receive at Destination
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmVoid(true)}
                disabled={pending}
              >
                Cancel Send
              </Button>
            </>
          )}
          {canVoid && isReceived && (
            <Button variant="outline" onClick={() => setConfirmVoid(true)} disabled={pending}>
              Void Transfer
            </Button>
          )}
          <Button variant="outline" onClick={onComplete}>
            {isCancelled ? "Back" : "Done"}
          </Button>
        </div>
      </OperationalCard>

      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete draft transfer?"
        description="This permanently removes the transfer and all lines. No stock has been moved yet."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteDraft}
      />

      <ConfirmActionDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        title={isSent ? "Cancel sent transfer?" : "Void received transfer?"}
        description="Stock levels will be reversed to undo this transfer. This cannot be undone."
        confirmLabel="Void & reverse stock"
        destructive
        onConfirm={handleVoid}
      />
    </div>
  );
}
