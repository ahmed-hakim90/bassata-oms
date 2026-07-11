"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { formatDateTime } from "@/lib/format";
import type { Product, Store, Warehouse } from "@/lib/types";
import type { TransferWithLines } from "@/modules/transfers/services/transfer.service";
import { TransferForm } from "./transfer-form";

interface TransfersPageProps {
  transfers: TransferWithLines[];
  stores: Store[];
  warehouses: Warehouse[];
  products: Product[];
  storeId: string;
}

const TRANSFER_STATUS_LABELS: Record<TransferWithLines["status"], string> = {
  draft: "مسودة",
  sent: "مرسلة",
  received: "مستلمة",
  cancelled: "ملغاة",
};

const statusVariant: Record<
  TransferWithLines["status"],
  "draft" | "warning" | "success" | "danger"
> = {
  draft: "draft",
  sent: "warning",
  received: "success",
  cancelled: "danger",
};

const statusAccent: Record<TransferWithLines["status"], string> = {
  draft: "var(--mds-color-border-default)",
  sent: "var(--mds-color-feedback-warning)",
  received: "var(--mds-color-feedback-success)",
  cancelled: "var(--mds-color-feedback-danger)",
};

export function TransfersPage({
  transfers,
  stores,
  warehouses,
  products,
  storeId,
}: TransfersPageProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (creating || editingId) {
    return (
      <>
        <PageHeader
          title={editingId ? "تحويل" : "تحويل جديد"}
          description={editingId ? "عرض أو تعديل التحويل" : "نقل مخزون بين الفروع"}
        />
        <TransferForm
          stores={stores}
          warehouses={warehouses}
          products={products}
          defaultFromStoreId={storeId}
          initialTransferId={editingId ?? undefined}
          onComplete={() => {
            setCreating(false);
            setEditingId(null);
            router.refresh();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="التحويلات"
        description="حركات مخزون بين الفروع"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> تحويل جديد
          </Button>
        }
      />

      {transfers.length === 0 ? (
        <EmptyStateBlock
          title="لا توجد تحويلات بعد"
          description="أنشئ تحويلًا لنقل المخزون بين الفروع."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> تحويل جديد
            </Button>
          }
        />
      ) : (
        <div className="grid gap-[var(--mds-space-3)]">
          {transfers.map((t) => (
            <OperationalCard key={t.id} accent={statusAccent[t.status]}>
              <div className="flex flex-wrap items-center justify-between gap-[var(--mds-space-4)]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-[var(--mds-space-2)]">
                    <span className="font-semibold">
                      {t.fromStoreName} / {t.fromWarehouseName}
                    </span>
                    <span className="text-muted-foreground">←</span>
                    <span className="font-semibold">
                      {t.toStoreName} / {t.toWarehouseName}
                    </span>
                    <StatusPill
                      label={TRANSFER_STATUS_LABELS[t.status]}
                      variant={statusVariant[t.status]}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.lines.length} أصناف · {formatDateTime(t.created_at)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditingId(t.id)}>
                  <Pencil className="size-4" />
                  فتح
                </Button>
              </div>
            </OperationalCard>
          ))}
        </div>
      )}
    </>
  );
}
