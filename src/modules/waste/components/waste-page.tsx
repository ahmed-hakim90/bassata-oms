"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
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

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <KpiCard label="الوحدات (30 يوم)" value={String(summary.totalUnits)} icon={<Trash2 className="size-5" />} />
        <KpiCard label="السجلات" value={String(summary.recordCount)} />
        <KpiCard
          label="أهم سبب"
          value={
            summary.byReason.sort((a, b) => b.units - a.units)[0]?.label ?? "—"
          }
        />
      </div>

      <OperationalCard title="آخر السجلات">
        {records.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">لا يوجد هالك مسجل بعد</p>
        ) : (
          <ul className="divide-y">
            {records.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{r.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.warehouseName} · {r.reason_code} · {formatDateTime(r.created_at)}
                  </p>
                </div>
                <span className="font-semibold text-destructive">−{r.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </OperationalCard>
    </>
  );
}
