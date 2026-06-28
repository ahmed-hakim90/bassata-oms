"use client";

import { useState, useTransition } from "react";
import { ClipboardList, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { formatDateTime } from "@/lib/format";
import type { Product, Warehouse } from "@/lib/types";
import { selectLabelById } from "@/lib/select-label";
import type { StockCountWithLines } from "@/modules/stock-count/services/count.service";
import { startCountAction } from "@/modules/stock-count/actions/count.actions";
import { StockCountWizard } from "./stock-count-wizard";

interface StockCountPageProps {
  counts: StockCountWithLines[];
  activeCount: StockCountWithLines | null;
  products: Product[];
  warehouses: Warehouse[];
}

export function StockCountPage({
  counts,
  activeCount,
  products,
  warehouses,
}: StockCountPageProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [warehouseId, setWarehouseId] = useState(
    activeCount?.warehouse_id ??
      warehouses.find((w) => w.is_default)?.id ??
      warehouses[0]?.id ??
      ""
  );

  const startCount = () => {
    startTransition(async () => {
      try {
        await startCountAction(warehouseId);
        toast.success("تم بدء الجرد");
        router.refresh();
      } catch {
        toast.error("فشل بدء الجرد");
      }
    });
  };

  return (
    <>
      <PageHeader
        title="جرد المخزون"
        description="جرد دوري وتسويات الفروقات"
        action={
          !activeCount && (
            <div className="flex flex-wrap gap-2">
              <Select value={warehouseId} onValueChange={(v) => setWarehouseId(v ?? "")}>
                <SelectTrigger className="w-48">
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
              <Button onClick={startCount} disabled={pending || !warehouseId}>
                <Play className="size-4" /> بدء الجرد
              </Button>
            </div>
          )
        }
      />

      {activeCount ? (
        <StockCountWizard
          count={activeCount}
          products={products}
          onComplete={() => router.refresh()}
        />
      ) : (
        <OperationalCard title="جرد سابق">
          {counts.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <ClipboardList className="mb-4 size-12 text-muted-foreground" />
              <p className="text-muted-foreground">لا توجد جردات بعد</p>
              <Button className="mt-4" onClick={startCount} disabled={pending || !warehouseId}>
                بدء أول جرد
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {counts.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">
                      جرد {c.id.slice(-6).toUpperCase()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(c.started_at)}
                      {c.completed_at && ` · مكتمل ${formatDateTime(c.completed_at)}`}
                    </p>
                  </div>
                  <StatusPill
                    label={c.status.replace("_", " ")}
                    variant={c.status === "completed" ? "success" : "info"}
                  />
                </li>
              ))}
            </ul>
          )}
        </OperationalCard>
      )}
    </>
  );
}
