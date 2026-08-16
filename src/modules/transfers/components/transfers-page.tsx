"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, ArrowLeftRight } from "lucide-react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { KpiCard } from "@/components/Velora/kpi-card";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { StatusPill } from "@/components/Velora/status-pill";
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

  const statusCounts = useMemo(() => {
    const counts = { draft: 0, sent: 0, received: 0, cancelled: 0 };
    for (const t of transfers) {
      counts[t.status] += 1;
    }
    return counts;
  }, [transfers]);

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
          <CompactAction
            label="تحويل جديد"
            icon={Plus}
            variant="default"
            alwaysLabeled
            onClick={() => setCreating(true)}
          />
        }
      />

      <div className="mb-3 grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="مسودة"
          value={String(statusCounts.draft)}
          icon={<Pencil className="size-5" />}
        />
        <KpiCard
          label="مرسلة"
          value={String(statusCounts.sent)}
          icon={<ArrowLeftRight className="size-5" />}
        />
        <KpiCard
          label="مستلمة"
          value={String(statusCounts.received)}
        />
        <KpiCard
          label="ملغاة"
          value={String(statusCounts.cancelled)}
        />
      </div>

      {transfers.length === 0 ? (
        <EmptyStateBlock
          title="لا توجد تحويلات بعد"
          description="أنشئ تحويلًا لنقل المخزون بين الفروع."
          action={
            <CompactAction
              label="تحويل جديد"
              icon={Plus}
              variant="default"
              alwaysLabeled
              onClick={() => setCreating(true)}
            />
          }
        />
      ) : (
        <div className="grid gap-[var(--mds-space-3)]">
          {transfers.map((t) => (
            <MobileEntityCard
              key={t.id}
              title={`${t.fromStoreName} / ${t.fromWarehouseName}`}
              subtitle={`← ${t.toStoreName} / ${t.toWarehouseName}`}
              badge={
                <StatusPill
                  label={TRANSFER_STATUS_LABELS[t.status]}
                  variant={statusVariant[t.status]}
                />
              }
              fields={[
                { label: "أصناف", value: String(t.lines.length) },
                { label: "التاريخ", value: formatDateTime(t.created_at) },
              ]}
              footer={
                <CompactActions className="w-full justify-end">
                  <CompactAction
                    label="فتح"
                    icon={Pencil}
                    onClick={() => setEditingId(t.id)}
                  />
                </CompactActions>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
