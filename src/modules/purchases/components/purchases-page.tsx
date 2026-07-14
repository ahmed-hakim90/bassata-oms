"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type PurchasesTab = "drafts" | "received" | "history";

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

function isPurchasesTab(value: string | null): value is PurchasesTab {
  return value === "drafts" || value === "received" || value === "history";
}

function sortByNewest(a: PurchaseWithLines, b: PurchaseWithLines) {
  const aAt = a.received_at ?? a.created_at;
  const bAt = b.received_at ?? b.created_at;
  return new Date(bAt).getTime() - new Date(aAt).getTime();
}

function PurchaseInvoiceCard({
  purchase,
  currency,
  onOpen,
}: {
  purchase: PurchaseWithLines;
  currency: string;
  onOpen: (id: string) => void;
}) {
  const isDraft = purchase.status === "draft";
  const stamp = purchase.received_at ?? purchase.created_at;

  return (
    <OperationalCard accent="var(--mds-color-action-primary)">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{purchase.invoice_number}</h3>
              <StatusPill
                label={statusLabels[purchase.status]}
                variant={statusVariant[purchase.status]}
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {purchase.supplierName} · {purchase.lines.length} أصناف
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {purchase.warehouseName} · {formatDateTime(stamp)}
            </p>
            {isDraft ? (
              <p className="mt-1 text-xs text-muted-foreground">
                مسودة محفوظة — المخزون لم يتحدث بعد
              </p>
            ) : null}
          </div>
          <p className="shrink-0 text-lg font-semibold tabular-nums sm:text-xl">
            {formatCurrency(purchase.total, currency)}
          </p>
        </div>
        <Button
          variant={isDraft ? "default" : "outline"}
          className="min-h-11 w-full sm:w-auto sm:self-end"
          onClick={() => onOpen(purchase.id)}
        >
          <Pencil className="size-4" />
          {isDraft ? "متابعة" : "فتح"}
        </Button>
      </div>
    </OperationalCard>
  );
}

function InvoiceList({
  items,
  currency,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onOpen,
}: {
  items: PurchaseWithLines[];
  currency: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  onOpen: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyStateBlock
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{items.length} فاتورة</p>
      {items.map((purchase) => (
        <PurchaseInvoiceCard
          key={purchase.id}
          purchase={purchase}
          currency={currency}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

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

  const drafts = useMemo(
    () => purchases.filter((p) => p.status === "draft").sort(sortByNewest),
    [purchases]
  );
  const received = useMemo(
    () => purchases.filter((p) => p.status === "received").sort(sortByNewest),
    [purchases]
  );
  const cancelled = useMemo(
    () => purchases.filter((p) => p.status === "cancelled").sort(sortByNewest),
    [purchases]
  );

  const tabFromQuery = searchParams.get("tab");
  const defaultTab: PurchasesTab = drafts.length > 0 ? "drafts" : "received";
  const activeTab: PurchasesTab = isPurchasesTab(tabFromQuery) ? tabFromQuery : defaultTab;

  const setTab = (tab: string | number | null) => {
    const next = typeof tab === "string" && isPurchasesTab(tab) ? tab : defaultTab;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("invoice");
    if (next === defaultTab) params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `/inventory/purchases?${qs}` : "/inventory/purchases");
  };

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
            if (invoiceFromQuery) router.replace("/inventory/purchases?tab=drafts");
            else router.refresh();
          }}
        />
      </>
    );
  }

  const newPurchaseButton = (
    <Button className="min-h-11" onClick={() => setCreating(true)}>
      <Plus className="size-4" /> شراء جديد
    </Button>
  );

  return (
    <>
      <PageHeader
        title="المشتريات"
        description="مسودات مؤقتة، فواتير مستلمة، وسجل الأسعار والإلغاءات"
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
            {newPurchaseButton}
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setTab} className="gap-4">
        <TabsList
          variant="default"
          className="grid h-auto w-full grid-cols-3 gap-1 p-1 sm:inline-flex sm:w-fit"
        >
          <TabsTrigger value="drafts" className="min-h-10 px-3 py-2">
            مؤقتة
            {drafts.length > 0 ? (
              <span className="ms-1.5 tabular-nums text-muted-foreground">
                ({drafts.length})
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="received" className="min-h-10 px-3 py-2">
            مستلمة
            {received.length > 0 ? (
              <span className="ms-1.5 tabular-nums text-muted-foreground">
                ({received.length})
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-10 px-3 py-2">
            سجل
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="mt-0">
          <InvoiceList
            items={drafts}
            currency={currency}
            emptyTitle="مفيش فواتير مؤقتة"
            emptyDescription="أنشئ مسودة، أضف الأصناف، وبعدين استلم عشان المخزون يتحدّث."
            emptyAction={newPurchaseButton}
            onOpen={setEditingId}
          />
        </TabsContent>

        <TabsContent value="received" className="mt-0">
          <InvoiceList
            items={received}
            currency={currency}
            emptyTitle="مفيش فواتير مستلمة"
            emptyDescription="بعد استلام المسودة هتظهر هنا مع تحديث المخزون."
            emptyAction={newPurchaseButton}
            onOpen={setEditingId}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="grid gap-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SupplierPriceHistory history={priceHistory} currency={currency} />
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                فواتير ملغاة / معاد فتحها
              </h3>
              <InvoiceList
                items={cancelled}
                currency={currency}
                emptyTitle="مفيش سجل إلغاءات"
                emptyDescription="الفواتير الملغاة هتظهر هنا. سجل أسعار الموردين فوق."
                onOpen={setEditingId}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
