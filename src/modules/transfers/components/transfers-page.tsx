"use client";

import { useState } from "react";
import { ArrowLeftRight, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
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

const statusVariant: Record<
  TransferWithLines["status"],
  "draft" | "warning" | "success" | "danger"
> = {
  draft: "draft",
  sent: "warning",
  received: "success",
  cancelled: "danger",
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
        <OperationalCard title="لا توجد تحويلات بعد">
          <div className="flex flex-col items-center py-12">
            <ArrowLeftRight className="mb-4 size-12 text-muted-foreground" />
            <Button onClick={() => setCreating(true)}>إنشاء تحويل</Button>
          </div>
        </OperationalCard>
      ) : (
        <div className="grid gap-4">
          {transfers.map((t) => (
            <OperationalCard key={t.id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {t.fromStoreName} / {t.fromWarehouseName} → {t.toStoreName} / {t.toWarehouseName}
                    </span>
                    <StatusPill label={t.status} variant={statusVariant[t.status]} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.lines.length} أصناف · {formatDateTime(t.created_at)}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setEditingId(t.id)}>
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
