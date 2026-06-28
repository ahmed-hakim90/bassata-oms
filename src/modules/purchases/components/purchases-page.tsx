"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Truck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Product, Supplier, Warehouse } from "@/lib/types";
import type { PurchaseWithLines } from "@/modules/purchases/services/purchase.service";
import type { SupplierPriceSummary } from "@/modules/purchases/services/price-history.service";
import { PurchaseForm } from "./purchase-form";
import { SupplierPriceHistory } from "./supplier-price-history";

interface PurchasesPageProps {
  purchases: PurchaseWithLines[];
  priceHistory: SupplierPriceSummary[];
  suppliers: Supplier[];
  products: Product[];
  warehouses: Warehouse[];
  currency: string;
}

const statusVariant: Record<
  PurchaseWithLines["status"],
  "draft" | "success" | "danger"
> = {
  draft: "draft",
  received: "success",
  cancelled: "danger",
};

export function PurchasesPage({
  purchases,
  priceHistory,
  suppliers,
  products,
  warehouses,
  currency,
}: PurchasesPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const invoiceFromQuery = searchParams.get("invoice");
  const activeEditingId = editingId ?? invoiceFromQuery;

  if (creating || activeEditingId) {
    return (
      <>
        <PageHeader
          title={activeEditingId ? "فاتورة شراء" : "استلام مشتريات"}
          description={activeEditingId ? "عرض أو تعديل الفاتورة" : "امسح الأصناف واستلمها في المخزون"}
        />
        <PurchaseForm
          suppliers={suppliers}
          products={products}
          warehouses={warehouses}
          currency={currency}
          initialInvoiceId={activeEditingId ?? undefined}
          onComplete={() => {
            setCreating(false);
            setEditingId(null);
            if (invoiceFromQuery) router.replace("/inventory/purchases");
            else router.refresh();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="المشتريات"
        description="استلام فواتير الموردين وتحديث المخزون"
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/inventory/suppliers"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              إدارة الموردين
            </Link>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> شراء جديد
            </Button>
          </div>
        }
      />

      {purchases.length === 0 ? (
        <OperationalCard
          title="لا توجد مشتريات بعد"
          description="أنشئ أول فاتورة شراء لاستلام المخزون"
        >
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <Truck className="size-8" />
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> شراء جديد
            </Button>
          </div>
        </OperationalCard>
      ) : (
        <div className="grid gap-4">
          <SupplierPriceHistory history={priceHistory} currency={currency} />
          {purchases.map((p) => (
            <OperationalCard key={p.id} accent="#2563EB">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{p.invoice_number}</h3>
                    <StatusPill label={p.status} variant={statusVariant[p.status]} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.supplierName} · {p.warehouseName} · {p.lines.length} أصناف ·{" "}
                    {formatDateTime(p.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xl font-semibold">
                    {formatCurrency(p.total, currency)}
                  </p>
                  <Button variant="outline" onClick={() => setEditingId(p.id)}>
                    <Pencil className="size-4" />
                    فتح
                  </Button>
                </div>
              </div>
            </OperationalCard>
          ))}
        </div>
      )}
    </>
  );
}
