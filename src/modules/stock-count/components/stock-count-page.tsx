"use client";

import { useState, useTransition } from "react";
import { Play } from "lucide-react";
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
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { formatDateTime } from "@/lib/format";
import type { Product, Warehouse } from "@/lib/types";
import { selectLabelById } from "@/lib/select-label";
import type { StockCountWithLines } from "@/modules/stock-count/services/count.service";
import { startCountAction } from "@/modules/stock-count/actions/count.actions";
import { StockCountWizard } from "./stock-count-wizard";

function statusLabel(status: StockCountWithLines["status"]) {
  switch (status) {
    case "completed":
      return { label: "مكتمل", variant: "success" as const };
    case "pending_approval":
      return { label: "بانتظار الاعتماد", variant: "warning" as const };
    case "approved":
      return { label: "معتمد", variant: "info" as const };
    default:
      return { label: "جارٍ العد", variant: "info" as const };
  }
}

interface StockCountPageProps {
  counts: StockCountWithLines[];
  activeCount: StockCountWithLines | null;
  products: Product[];
  warehouses: Warehouse[];
  canApprove: boolean;
  trackedProductCount: number;
}

export function StockCountPage({
  counts,
  activeCount,
  products,
  warehouses,
  canApprove,
  trackedProductCount,
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
        description="جرد دوري مع اعتماد قبل ترحيل الفروقات"
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
          canApprove={canApprove}
          trackedProductCount={trackedProductCount}
          onComplete={() => router.refresh()}
        />
      ) : counts.length === 0 ? (
        <EmptyStateBlock
          title="لا توجد جردات بعد"
          description="ابدأ جردًا دوريًا لتسوية فروقات المخزون."
          action={
            <Button onClick={startCount} disabled={pending || !warehouseId}>
              <Play className="size-4" /> بدء أول جرد
            </Button>
          }
        />
      ) : (
        <OperationalCard title="الجردات السابقة" description={`${counts.length} جردة`}>
          <ul className="divide-y divide-border/60">
            {counts.map((c) => {
              const status = statusLabel(c.status);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-[var(--mds-space-4)] py-[var(--mds-space-3)]"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      جرد #{c.id.slice(-6).toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      بدأ {formatDateTime(c.started_at)}
                      {c.completed_at && ` · اكتمل ${formatDateTime(c.completed_at)}`}
                    </p>
                  </div>
                  <StatusPill label={status.label} variant={status.variant} />
                </li>
              );
            })}
          </ul>
        </OperationalCard>
      )}
    </>
  );
}
