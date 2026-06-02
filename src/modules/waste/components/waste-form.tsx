"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import type { Product, Warehouse } from "@/lib/types";
import { recordWasteAction } from "@/modules/waste/actions/waste.actions";
import { WASTE_REASONS } from "@/modules/waste/constants";
import { selectLabelById, selectLabelByKey } from "@/lib/select-label";

interface WasteFormProps {
  products: Product[];
  warehouses: Warehouse[];
  onComplete: () => void;
}

export function WasteForm({ products, warehouses, onComplete }: WasteFormProps) {
  const [pending, startTransition] = useTransition();
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ""
  );
  const [quantity, setQuantity] = useState(1);
  const [reasonCode, setReasonCode] = useState(WASTE_REASONS[0].code);
  const [notes, setNotes] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !warehouseId) {
      toast.error("Select a product and warehouse");
      return;
    }
    startTransition(async () => {
      try {
        await recordWasteAction({ productId, warehouseId, quantity, reasonCode, notes });
        toast.success("Waste recorded");
        onComplete();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <OperationalCard title="Record Waste" description="Shrinkage and spoilage">
      <form onSubmit={submit} className="grid max-w-lg gap-4">
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
          <Label>Product</Label>
          <Select value={productId} onValueChange={(v) => setProductId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select product">
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
        </div>
        <div className="space-y-2">
          <Label>Quantity</Label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          />
        </div>
        <div className="space-y-2">
          <Label>Reason</Label>
          <Select
            value={reasonCode}
            onValueChange={(v) => {
              if (v) setReasonCode(v as typeof reasonCode);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) =>
                  selectLabelByKey(
                    WASTE_REASONS,
                    value,
                    (r) => r.code,
                    (r) => r.label
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {WASTE_REASONS.map((r) => (
                <SelectItem key={r.code} value={r.code} label={r.label}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional details..."
          />
        </div>
        <Button type="submit" disabled={pending} variant="destructive">
          <Trash2 className="size-4" /> Record Waste
        </Button>
      </form>
    </OperationalCard>
  );
}
