"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
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

const statusLabels: Record<PurchaseWithLines["status"], string> = {
  draft: "مسودة",
  received: "مستلمة",
  cancelled: "ملغاة",
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
          title={activeEditingId ? "فاتورة شراء" : "فاتورة شراء جديدة"}
          description={
            activeEditingId
              ? "أكمل المسودة ثم احفظ نهائيًا لتحديث المخزون"
              : "مسودة سريعة → أصناف → حفظ نهائي"
          }
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
        description="مسودة مؤقتة ثم حفظ نهائي يحدّث المخزون"
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link
              href="/inventory/suppliers"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "min-h-11 justify-center"
              )}
            >
              إدارة الموردين
            </Link>
            <Button className="min-h-11" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> شراء جديد
            </Button>
          </div>
        }
      />

      {purchases.length === 0 ? (
        <EmptyStateBlock
          title="لا توجد مشتريات بعد"
          description="أنشئ فاتورة كمسودة، أضف الأصناف، ثم احفظ نهائيًا لتحديث المخزون."
          action={
            <Button className="min-h-11" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> شراء جديد
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="hidden sm:block">
            <SupplierPriceHistory history={priceHistory} currency={currency} />
          </div>
          <p className="text-sm text-muted-foreground">{purchases.length} فاتورة</p>
          {purchases.map((p) => {
            const isDraft = p.status === "draft";
            return (
              <OperationalCard key={p.id} accent="var(--mds-color-action-primary)">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{p.invoice_number}</h3>
                        <StatusPill
                          label={statusLabels[p.status]}
                          variant={statusVariant[p.status]}
                        />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {p.supplierName} · {p.lines.length} أصناف
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.warehouseName} · {formatDateTime(p.created_at)}
                      </p>
                      {isDraft ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          مسودة محفوظة — المخزون لم يتحدث بعد
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-lg font-semibold tabular-nums sm:text-xl">
                      {formatCurrency(p.total, currency)}
                    </p>
                  </div>
                  <Button
                    variant={isDraft ? "default" : "outline"}
                    className="min-h-11 w-full sm:w-auto sm:self-end"
                    onClick={() => setEditingId(p.id)}
                  >
                    <Pencil className="size-4" />
                    {isDraft ? "متابعة" : "فتح"}
                  </Button>
                </div>
              </OperationalCard>
            );
          })}
        </div>
      )}
    </>
  );
}
