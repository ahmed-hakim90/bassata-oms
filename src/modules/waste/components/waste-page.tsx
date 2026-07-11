"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
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
          <Button onClick={() => setShowForm(true)}>
            <Plus className="size-4" /> تسجيل هالك
          </Button>
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
            <Button onClick={() => setShowForm(true)}>
              <Plus className="size-4" /> تسجيل هالك
            </Button>
          }
        />
      ) : (
        <OperationalCard title="آخر السجلات" description={`${records.length} سجل`}>
          <ul className="divide-y divide-border/60">
            {records.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-[var(--mds-space-4)] py-[var(--mds-space-3)]">
                <div className="min-w-0">
                  <p className="font-medium">{r.productName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {r.warehouseName} · {r.reason_code} · {formatDateTime(r.created_at)}
                  </p>
                </div>
                <span className="shrink-0 rounded-[var(--mds-radius-md)] bg-destructive/10 px-[var(--mds-space-2)] py-0.5 text-sm font-semibold text-destructive">
                  −{r.quantity}
                </span>
              </li>
            ))}
          </ul>
        </OperationalCard>
      )}
    </>
  );
}
