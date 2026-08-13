"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { CompactAction } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { KpiCard } from "@/components/Velora/kpi-card";
import { formatDateTime } from "@/lib/format";
import type { Product, Warehouse } from "@/lib/types";
import type { WasteWithProduct } from "@/modules/waste/services/waste.service";
import { WasteForm } from "./waste-form";

interface WastePageProps {
  records: WasteWithProduct[];
  summary: {
    totalUnits: number;
    recordCount: number;
    byReason: { code: string; label: string; count: number; units: number }[];
  };
  products: Product[];
  warehouses: Warehouse[];
}

export function WastePage({ records, summary, products, warehouses }: WastePageProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <>
        <PageHeader title="تسجيل هالك" />
        <WasteForm
          products={products}
          warehouses={warehouses}
          onComplete={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="الهالك"
        description="تتبع الفاقد والتالف"
        action={
          <CompactAction
            label="تسجيل هالك"
            icon={Plus}
            variant="default"
            alwaysLabeled
            onClick={() => setShowForm(true)}
          />
        }
      />

      <div className="mb-[var(--mds-space-6)] grid gap-[var(--mds-space-4)] sm:grid-cols-3">
        <KpiCard label="الوحدات (30 يوم)" value={String(summary.totalUnits)} icon={<Trash2 className="size-5" />} />
        <KpiCard label="السجلات" value={String(summary.recordCount)} />
        <KpiCard
          label="أهم سبب"
          value={
            summary.byReason.sort((a, b) => b.units - a.units)[0]?.label ?? "—"
          }
        />
      </div>

      {records.length === 0 ? (
        <EmptyStateBlock
          title="لا يوجد هالك مسجل بعد"
          description="سجّل الفاقد والتالف لتتبع أسباب الهالك."
          action={
            <CompactAction
              label="تسجيل هالك"
              icon={Plus}
              variant="default"
              alwaysLabeled
              onClick={() => setShowForm(true)}
            />
          }
        />
      ) : (
        <div className="grid gap-[var(--mds-space-3)]">
          {records.map((r) => (
            <MobileEntityCard
              key={r.id}
              title={r.productName}
              subtitle={r.warehouseName}
              badge={
                <span className="rounded-[var(--mds-radius-md)] bg-destructive/10 px-[var(--mds-space-2)] py-0.5 text-sm font-semibold text-destructive">
                  −{r.quantity}
                </span>
              }
              fields={[
                { label: "السبب", value: r.reason_code },
                { label: "التاريخ", value: formatDateTime(r.created_at) },
              ]}
            />
          ))}
        </div>
      )}
    </>
  );
}
