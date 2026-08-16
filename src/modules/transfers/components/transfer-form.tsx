"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Check, PackageCheck, Plus, Trash2, Undo2, X } from "lucide-react";
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
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { OperatorShortcutHint } from "@/components/Velora/operator-shortcut-hint";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import {
  backgroundMutationKey,
  useBackgroundMutation,
} from "@/hooks/use-background-mutation";
import { useOperatorShortcuts } from "@/hooks/use-operator-shortcuts";
import { useUndoStack } from "@/hooks/use-undo-stack";
import { OPERATOR_SHORTCUTS } from "@/lib/keyboard";
import type { Product, Store, TransferOrderLine, Warehouse } from "@/lib/types";
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
  const [lifecyclePending, startLifecycle] = useTransition();
  const { run: runBackground } = useBackgroundMutation();
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
  const snapshotRef = useRef<TransferWithLines | null>(null);
  const cancelledTempIdsRef = useRef(new Set<string>());
  const transferRef = useRef<TransferWithLines | null>(null);
  const isUndoingRef = useRef(false);
  const removeLineRef = useRef<(lineId: string) => void>(() => {});
  const updateLineQtyRef = useRef<(lineId: string, qty: number) => void>(() => {});
  const { push: pushUndo, undo: undoLast, clear: clearUndo } = useUndoStack();
  transferRef.current = transfer;

  useEffect(() => {
    if (!initialTransferId) return;
    startLifecycle(async () => {
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
    void (async () => {
      const result = await getTransferDetailAction(id);
      if (result.ok) setTransfer(result.data);
    })();
  };

  const createDraft = () => {
    startLifecycle(async () => {
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
    snapshotRef.current = transfer;
    const existing = transfer.lines.find(
      (l) => l.product_id === productId && l.variant_id == null
    );
    let nextLines: TransferOrderLine[];
    let optimisticId: string;
    if (existing) {
      optimisticId = existing.id;
      nextLines = transfer.lines.map((l) =>
        l.id === existing.id
          ? { ...l, quantity_sent: l.quantity_sent + quantity }
          : l
      );
    } else {
      optimisticId = `temp-${crypto.randomUUID()}`;
      nextLines = [
        ...transfer.lines,
        {
          id: optimisticId,
          transfer_id: transfer.id,
          product_id: productId,
          variant_id: null,
          quantity_sent: quantity,
          quantity_received: 0,
          batch_id: null,
          batch_number: null,
        },
      ];
    }
    setTransfer({ ...transfer, lines: nextLines });
    setProductId("");
    setQuantity(1);

    if (!isUndoingRef.current) {
      const merged = Boolean(existing);
      const priorQty = existing?.quantity_sent ?? 0;
      const productIdForUndo = productId;
      pushUndo({
        undo: () => {
          const current = transferRef.current;
          if (!current) return;
          const line = current.lines.find(
            (l) => l.product_id === productIdForUndo && l.variant_id == null
          );
          if (!line) return;
          isUndoingRef.current = true;
          if (!merged || priorQty <= 0) {
            removeLineRef.current(line.id);
          } else {
            updateLineQtyRef.current(line.id, priorQty);
          }
          isUndoingRef.current = false;
        },
      });
    }

    void (async () => {
      const result = await addTransferLineAction({
        transferId: transfer.id,
        productId,
        quantity,
      });
      if (!result.ok) {
        if (snapshotRef.current) setTransfer(snapshotRef.current);
        toast.error(result.error);
        return;
      }
      if (cancelledTempIdsRef.current.has(optimisticId)) {
        cancelledTempIdsRef.current.delete(optimisticId);
        void removeTransferLineAction(result.data.id);
        return;
      }
      setTransfer((prev) => {
        if (!prev) return prev;
        const stillPresent = prev.lines.some(
          (l) =>
            l.id === optimisticId ||
            (l.product_id === result.data.product_id &&
              (l.variant_id ?? null) === (result.data.variant_id ?? null))
        );
        if (!stillPresent) {
          void removeTransferLineAction(result.data.id);
          return prev;
        }
        const others = prev.lines.filter(
          (l) =>
            !(
              l.product_id === result.data.product_id &&
              (l.variant_id ?? null) === (result.data.variant_id ?? null)
            )
        );
        return { ...prev, lines: [...others, result.data] };
      });
    })();
  };

  const removeLine = (lineId: string) => {
    if (!transfer) return;
    const removed = transfer.lines.find((l) => l.id === lineId);
    snapshotRef.current = transfer;
    setTransfer({
      ...transfer,
      lines: transfer.lines.filter((l) => l.id !== lineId),
    });

    if (!isUndoingRef.current && removed) {
      const productIdForUndo = removed.product_id;
      const qtyForUndo = removed.quantity_sent;
      pushUndo({
        undo: () => {
          const current = transferRef.current;
          if (!current) return;
          isUndoingRef.current = true;
          void (async () => {
            const result = await addTransferLineAction({
              transferId: current.id,
              productId: productIdForUndo,
              quantity: qtyForUndo,
            });
            isUndoingRef.current = false;
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setTransfer((prev) => {
              if (!prev) return prev;
              const others = prev.lines.filter(
                (l) =>
                  !(
                    l.product_id === result.data.product_id &&
                    (l.variant_id ?? null) === (result.data.variant_id ?? null)
                  )
              );
              return { ...prev, lines: [...others, result.data] };
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
      const result = await removeTransferLineAction(lineId);
      if (!result.ok) {
        if (snapshotRef.current) setTransfer(snapshotRef.current);
        toast.error(result.error);
      }
    })();
  };

  const updateLineQty = (lineId: string, qty: number) => {
    if (!transfer || qty <= 0 || lineId.startsWith("temp-")) return;
    snapshotRef.current = transfer;
    setTransfer({
      ...transfer,
      lines: transfer.lines.map((l) =>
        l.id === lineId ? { ...l, quantity_sent: qty } : l
      ),
    });

    void (async () => {
      const result = await updateTransferLineAction({ lineId, quantity: qty });
      if (!result.ok) {
        if (snapshotRef.current) setTransfer(snapshotRef.current);
        toast.error(result.error);
        return;
      }
      setTransfer((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lines: prev.lines.map((l) => (l.id === lineId ? result.data : l)),
        };
      });
    })();
  };

  removeLineRef.current = removeLine;
  updateLineQtyRef.current = updateLineQty;

  useOperatorShortcuts({
    enabled: transfer?.status === "draft",
    onSave: () => {
      if (!transfer || transfer.status !== "draft") return;
      toast.success("المسودة محفوظة — البنود بتتسجل تلقائي");
      onComplete();
    },
    onDelete: () => {
      if (!transfer || transfer.status !== "draft" || transfer.lines.length === 0) return;
      const last = transfer.lines[transfer.lines.length - 1];
      if (last) removeLine(last.id);
    },
    onUndo: () => {
      if (!undoLast()) toast.message("مفيش خطوة للتراجع");
    },
  });

  const send = () => {
    if (!transfer) return;
    const transferId = transfer.id;
    runBackground({
      key: backgroundMutationKey("transfer", "send", transferId),
      label: "جاري إرسال التحويل…",
      execute: async () => {
        const result = await sendTransferAction(transferId);
        if (!result.ok) throw new Error(result.error);
        return result;
      },
      successMessage: "تم إرسال التحويل",
      onSuccess: () => {
        refreshTransfer(transferId);
      },
    });
  };

  const receive = () => {
    if (!transfer) return;
    const transferId = transfer.id;
    onComplete();
    runBackground({
      key: backgroundMutationKey("transfer", "receive", transferId),
      label: "جاري استلام التحويل…",
      execute: async () => {
        const result = await receiveTransferAction(transferId);
        if (!result.ok) throw new Error(result.error);
        return result;
      },
      successMessage: "تم استلام التحويل",
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
    clearUndo();
    onComplete();
  };

  const saveStores = () => {
    if (!transfer) return;
    snapshotRef.current = transfer;
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

    void (async () => {
      const result = await updateDraftTransferAction({
        transferId: transfer.id,
        fromStoreId,
        toStoreId,
        fromWarehouseId,
        toWarehouseId,
      });
      if (!result.ok) {
        if (snapshotRef.current) setTransfer(snapshotRef.current);
        toast.error(result.error);
        return;
      }
      toast.success("تم تحديث الفروع");
    })();
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
      <div className="flex flex-col gap-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <OperationalCard
          accent="var(--mds-color-action-primary)"
          title="تحويل جديد"
          description="حدد الفروع والمخازن — الأزرار ثابتة تحت"
        >
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
                <SelectTrigger className="min-h-11 w-full">
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
                <SelectTrigger className="min-h-11 w-full">
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
                <SelectTrigger className="min-h-11 w-full">
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
                <SelectTrigger className="min-h-11 w-full">
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
          <EmptyStateBlock
            className="mt-6"
            title="لسه مفيش أصناف"
            description="بعد فتح المسودة هتقدر تضيف الأصناف في نفس الشاشة"
          />
        </OperationalCard>
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur-xl md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pt-3 lg:ps-64">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">تحويل جديد</p>
            <CompactActions>
              <CompactAction label="إلغاء" icon={X} onClick={onComplete} />
              <CompactAction
                label="فتح التحويل"
                icon={Plus}
                variant="default"
                disabled={
                  lifecyclePending ||
                  !fromWarehouseId ||
                  !toWarehouseId ||
                  fromWarehouseId === toWarehouseId
                }
                onClick={createDraft}
              />
            </CompactActions>
          </div>
        </div>
      </div>
    );
  }

  const isDraft = transfer.status === "draft";
  const isSent = transfer.status === "sent";
  const isReceived = transfer.status === "received";
  const isCancelled = transfer.status === "cancelled";
  const canVoid = isSent || isReceived;

  return (
    <div className="flex flex-col gap-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <OperationalCard
        accent="var(--mds-color-action-primary)"
        title={`${transfer.fromStoreName} → ${transfer.toStoreName}`}
        description={
          isDraft
            ? "مسودة تحويل — الرأس والأصناف ظاهرة · الأزرار ثابتة تحت"
            : `الحالة: ${transfer.status} · ${transfer.fromWarehouseName} → ${transfer.toWarehouseName}`
        }
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
              <div className="flex flex-row flex-wrap items-end gap-2">
                <Select
                  value={toStoreId}
                  onValueChange={(v) => {
                    const next = v ?? "";
                    setToStoreId(next);
                    setToWarehouseId(defaultWarehouseForStore(next));
                  }}
                >
                  <SelectTrigger className="h-11 w-full sm:h-9 sm:min-w-40">
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
                  <SelectTrigger className="h-11 w-full sm:h-9 sm:min-w-40">
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
                  className="h-11 w-auto shrink-0 sm:h-9"
                  onClick={saveStores}
                  disabled={
                    lifecyclePending ||
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
          <div className="flex flex-row flex-wrap items-center gap-2">
            <Select value={productId} onValueChange={(v) => setProductId(v ?? "")}>
              <SelectTrigger className="h-11 min-w-0 flex-1 sm:h-9 sm:min-w-48 sm:flex-none sm:w-auto">
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
              className="h-11 w-20 sm:h-9 sm:w-24"
            />
            <CompactAction
              label="إضافة"
              icon={Plus}
              variant="default"
              disabled={!productId || !transfer}
              onClick={addLine}
            />
          </div>
        )}
        <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
          <h3 className="text-sm font-semibold">الأصناف ({transfer.lines.length})</h3>
          {transfer.lines.length === 0 ? (
            <EmptyStateBlock
              title="مفيش أصناف في التحويل"
              description={
                isDraft
                  ? "اختَر منتج وكمية من فوق عشان تضيف بند."
                  : "التحويل بدون بنود."
              }
            />
          ) : (
            <ul className="space-y-2">
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
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </OperationalCard>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur-xl md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pt-3 lg:ps-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0 shrink">
            <p className="text-xs text-muted-foreground sm:text-sm">{transfer.lines.length} بند</p>
            <p className="truncate text-sm text-muted-foreground">
              {transfer.fromWarehouseName} → {transfer.toWarehouseName}
            </p>
            {isDraft ? <OperatorShortcutHint className="mt-0.5" /> : null}
          </div>
          <CompactActions>
          {isDraft ? (
            <>
              <CompactAction
                label="حفظ مؤقت"
                icon={Check}
                shortcut={OPERATOR_SHORTCUTS.save}
                onClick={() => {
                  toast.success("المسودة محفوظة — البنود بتتسجل تلقائي");
                  onComplete();
                }}
              />
              <CompactAction
                label="إرسال التحويل"
                icon={ArrowRight}
                variant="default"
                disabled={lifecyclePending || transfer.lines.length === 0}
                onClick={send}
              />
              <CompactAction
                label="حذف المسودة"
                icon={Trash2}
                variant="destructive"
                disabled={lifecyclePending}
                onClick={() => setConfirmDelete(true)}
              />
            </>
          ) : null}
          {isSent ? (
            <>
              <CompactAction
                label="الاستلام في الوجهة"
                icon={PackageCheck}
                variant="default"
                disabled={lifecyclePending}
                onClick={receive}
              />
              <CompactAction
                label="إلغاء الإرسال"
                icon={Undo2}
                disabled={lifecyclePending}
                onClick={() => setConfirmVoid(true)}
              />
            </>
          ) : null}
          {canVoid && isReceived ? (
            <CompactAction
              label="إلغاء التحويل"
              icon={Undo2}
              disabled={lifecyclePending}
              onClick={() => setConfirmVoid(true)}
            />
          ) : null}
          <CompactAction
            label={isCancelled ? "رجوع" : "تم"}
            icon={isCancelled ? X : Check}
            onClick={onComplete}
          />
          </CompactActions>
        </div>
      </div>

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
