"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark, Pencil, Plus, Tags, Truck, Receipt } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { KpiCard } from "@/components/Velora/kpi-card";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { StatusPill } from "@/components/Velora/status-pill";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { backgroundMutationKey } from "@/hooks/use-background-mutation";
import { useBackgroundMutationStore } from "@/stores/background-mutation-store";
import type { Product, PurchaseInvoice, Supplier, Warehouse } from "@/lib/types";
import type { PurchaseWithLines } from "@/modules/purchases/services/purchase.service";
import type { SupplierPriceSummary } from "@/modules/purchases/services/price-history.service";
import { PurchaseForm } from "./purchase-form";
import { SupplierPriceHistory } from "./supplier-price-history";
import { DocumentPrintPreviewModal } from "@/components/print/document-print-preview-modal";

interface PurchasesPageProps {
  purchases: PurchaseWithLines[];
  priceHistory: SupplierPriceSummary[];
  suppliers: Supplier[];
  products: Product[];
  warehouses: Warehouse[];
  currency: string;
  supplierDueTotal?: number;
  documentKind?: NonNullable<PurchaseInvoice["document_kind"]>;
  basePath?: string;
  title?: string;
  description?: string;
  createLabel?: string;
  allowCreate?: boolean;
  canManagePrintEngine?: boolean;
  importsEnabled?: boolean;
}

type PurchasesTab = "drafts" | "received" | "history";

const statusVariant: Partial<
  Record<PurchaseWithLines["status"], "draft" | "success" | "danger" | "warning" | "info">
> = {
  draft: "draft",
  received: "success",
  cancelled: "danger",
  submitted: "info",
  approved: "success",
  rejected: "danger",
  sent: "info",
  partial_invoiced: "warning",
  invoiced: "success",
  posted: "success",
};

const statusLabels: Partial<Record<PurchaseWithLines["status"], string>> = {
  draft: "مسودة",
  received: "مستلمة",
  cancelled: "ملغاة",
  submitted: "مقدَّم",
  approved: "معتمد",
  rejected: "مرفوض",
  sent: "مُرسل",
  partial_invoiced: "فوترة جزئية",
  invoiced: "محوَّل",
  posted: "مرحَّل",
};

function isPurchasesTab(value: string | null): value is PurchasesTab {
  return value === "drafts" || value === "received" || value === "history";
}

function sortByNewest(a: PurchaseWithLines, b: PurchaseWithLines) {
  const aAt = a.received_at ?? `${a.document_date}T12:00:00.000Z`;
  const bAt = b.received_at ?? `${b.document_date}T12:00:00.000Z`;
  return new Date(bAt).getTime() - new Date(aAt).getTime();
}

function PurchaseInvoiceCard({
  purchase,
  currency,
  receiving,
  onOpen,
  onPrintReceipt,
}: {
  purchase: PurchaseWithLines;
  currency: string;
  receiving?: boolean;
  onOpen: (id: string) => void;
  onPrintReceipt: (purchase: PurchaseWithLines) => void;
}) {
  const isDraft = purchase.status === "draft";
  const isReceived = purchase.status === "received";
  const stamp =
    purchase.received_at ?? `${purchase.document_date}T12:00:00.000Z`;

  return (
    <MobileEntityCard
      title={purchase.invoice_number}
      subtitle={`${purchase.supplierName || "بدون مورد"} · ${purchase.lines.length} أصناف`}
      badge={
        receiving ? (
          <StatusPill label="جاري الاستلام…" variant="info" />
        ) : (
          <StatusPill
            label={statusLabels[purchase.status] ?? purchase.status}
            variant={statusVariant[purchase.status] ?? "info"}
          />
        )
      }
      fields={[
        {
          label: "الإجمالي",
          value: (
            <span className="tabular-nums font-semibold">
              {formatCurrency(purchase.total, currency)}
            </span>
          ),
        },
        {
          label: "المخزن",
          value: purchase.warehouseName,
        },
        {
          label: "التاريخ",
          value: formatDateTime(stamp),
        },
        ...(isDraft && !receiving
          ? [
              {
                label: "ملاحظة",
                value: "مسودة — المخزون لم يتحدث بعد",
              },
            ]
          : []),
        ...(receiving
          ? [
              {
                label: "ملاحظة",
                value: "جاري تحديث المخزون في الخلفية",
              },
            ]
          : []),
      ]}
      footer={
        <CompactActions className="w-full justify-end">
          {purchase.lines.length > 0 ? (
            <CompactAction
              label="طباعة"
              icon={Receipt}
              className="border-primary text-primary"
              onClick={() => onPrintReceipt(purchase)}
            />
          ) : null}
          {isReceived ? (
            <CompactAction
              label="قائمة أسعار البيع"
              icon={Tags}
              variant="default"
              href={`/inventory/purchases/price-list?invoice=${purchase.id}`}
            />
          ) : null}
          <CompactAction
            label={isDraft ? "متابعة" : "فتح"}
            icon={Pencil}
            variant={isDraft ? "default" : "outline"}
            disabled={receiving}
            onClick={() => onOpen(purchase.id)}
          />
        </CompactActions>
      }
    />
  );
}

function InvoiceList({
  items,
  currency,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onOpen,
  onPrintReceipt,
}: {
  items: PurchaseWithLines[];
  currency: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  onOpen: (id: string) => void;
  onPrintReceipt: (purchase: PurchaseWithLines) => void;
}) {
  const mutations = useBackgroundMutationStore((s) => s.mutations);

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
      {items.map((purchase) => {
        const key = backgroundMutationKey("purchase", "receive", purchase.id);
        const receiving = mutations[key]?.status === "pending";
        return (
          <PurchaseInvoiceCard
            key={purchase.id}
            purchase={purchase}
            currency={currency}
            receiving={receiving}
            onOpen={onOpen}
            onPrintReceipt={onPrintReceipt}
          />
        );
      })}
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
  supplierDueTotal = 0,
  documentKind = "purchase_invoice",
  basePath = "/inventory/purchases",
  title = "المشتريات",
  description = "مسودات مؤقتة، فواتير مستلمة، وسجل الأسعار والإلغاءات",
  createLabel = "شراء جديد",
  allowCreate = true,
  canManagePrintEngine = false,
  importsEnabled = false,
}: PurchasesPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [printPreview, setPrintPreview] = useState<{
    href: string;
    title: string;
  } | null>(null);
  const invoiceFromQuery = searchParams.get("invoice");
  const createFromQuery = searchParams.get("create") === "1";
  const [createBootstrapped, setCreateBootstrapped] = useState(false);
  const activeEditingId = editingId ?? invoiceFromQuery;

  const closeForm = useCallback(() => {
    setCreating(false);
    setEditingId(null);
    if (invoiceFromQuery) router.replace(`${basePath}?tab=drafts`);
    else router.refresh();
  }, [invoiceFromQuery, router, basePath]);

  const startDraftCreate = useCallback(() => {
    if (documentKind !== "purchase_request" && suppliers.length === 0) {
      toast.error("ضيف مورد الأول من إدارة الموردين");
      return;
    }
    if (warehouses.length === 0) {
      toast.error("مفيش مخزن متاح — راجع إعدادات الفرع");
      return;
    }
    // افتح الوثيقة فورًا — المسودة تتسجل على السيرفر عند أول حفظ/صنف (مش قبل ما تشوف الفورم)
    setCreating(true);
  }, [suppliers.length, warehouses.length, documentKind]);

  useEffect(() => {
    if (!createFromQuery || createBootstrapped || invoiceFromQuery || !allowCreate) return;
    setCreateBootstrapped(true);
    startDraftCreate();
    router.replace(basePath, { scroll: false });
  }, [
    createFromQuery,
    createBootstrapped,
    invoiceFromQuery,
    allowCreate,
    startDraftCreate,
    router,
    basePath,
  ]);

  function openPurchaseReceipt(purchase: PurchaseWithLines) {
    setPrintPreview({
      href: `/print/purchases/${purchase.id}?embed=1`,
      title: purchase.invoice_number,
    });
  }

  const drafts = useMemo(
    () => purchases.filter((p) => p.status === "draft").sort(sortByNewest),
    [purchases]
  );
  const received = useMemo(
    () => purchases.filter((p) => p.status === "received").sort(sortByNewest),
    [purchases]
  );
  const submitted = useMemo(
    () => purchases.filter((p) => p.status === "submitted").sort(sortByNewest),
    [purchases]
  );
  const approved = useMemo(
    () => purchases.filter((p) => p.status === "approved").sort(sortByNewest),
    [purchases]
  );
  const sent = useMemo(
    () => purchases.filter((p) => p.status === "sent" || p.status === "partial_invoiced").sort(sortByNewest),
    [purchases]
  );
  const invoiced = useMemo(
    () => purchases.filter((p) => p.status === "invoiced").sort(sortByNewest),
    [purchases]
  );
  const posted = useMemo(
    () => purchases.filter((p) => p.status === "posted").sort(sortByNewest),
    [purchases]
  );
  const cancelled = useMemo(
    () => purchases.filter((p) => p.status === "cancelled").sort(sortByNewest),
    [purchases]
  );

  const receivedValue30d = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return received
      .filter((p) => {
        const at = p.received_at ? new Date(p.received_at) : null;
        return at != null && at >= from;
      })
      .reduce((sum, p) => sum + p.total, 0);
  }, [received]);

  const draftValue = useMemo(
    () => drafts.reduce((sum, p) => sum + p.total, 0),
    [drafts]
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
          title={activeEditingId ? title : createLabel}
          description={description}
        />
        <PurchaseForm
          suppliers={suppliers}
          products={products}
          warehouses={warehouses}
          currency={currency}
          initialInvoiceId={activeEditingId ?? undefined}
          documentKind={documentKind}
          canManagePrintEngine={canManagePrintEngine}
          importsEnabled={importsEnabled}
          onComplete={closeForm}
        />
      </>
    );
  }

  const newPurchaseButton = (
    <CompactAction
      label={createLabel}
      icon={Plus}
      variant="default"
      alwaysLabeled
      onClick={startDraftCreate}
    />
  );

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          <CompactActions>
            {documentKind === "purchase_invoice" ? (
              <CompactAction
                label="قائمة أسعار من منتجات"
                icon={Tags}
                href="/inventory/purchases/price-list"
              />
            ) : null}
            <CompactAction
              label="إدارة الموردين"
              icon={Truck}
              href="/inventory/suppliers"
            />
            {allowCreate ? newPurchaseButton : null}
          </CompactActions>
        }
      />

      {documentKind === "purchase_invoice" ? (
      <div className="mb-3 grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="مسودات"
          value={String(drafts.length)}
          change={formatCurrency(draftValue, currency)}
          trend="neutral"
          icon={<Pencil className="size-5" />}
        />
        <KpiCard
          label="مستلمة"
          value={String(received.length)}
          icon={<Receipt className="size-5" />}
        />
        <KpiCard
          label="قيمة الاستلام (30 يوم)"
          value={formatCurrency(receivedValue30d, currency)}
          icon={<Truck className="size-5" />}
        />
        <KpiCard
          label="مستحق الموردين"
          value={formatCurrency(supplierDueTotal, currency)}
          change="افتح الموردين للتفاصيل"
          trend="neutral"
          icon={<Landmark className="size-5" />}
        />
      </div>
      ) : null}

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
            {documentKind === "purchase_request"
              ? "معتمدة"
              : documentKind === "purchase_order"
                ? "مُرسلة"
                : documentKind === "purchase_return"
                  ? "مرحَّلة"
                  : "مستلمة"}
            {(documentKind === "purchase_request"
              ? approved.length
              : documentKind === "purchase_order"
                ? sent.length
                : documentKind === "purchase_return"
                  ? posted.length
                  : received.length) > 0 ? (
              <span className="ms-1.5 tabular-nums text-muted-foreground">
                (
                {documentKind === "purchase_request"
                  ? approved.length
                  : documentKind === "purchase_order"
                    ? sent.length
                    : documentKind === "purchase_return"
                      ? posted.length
                      : received.length}
                )
              </span>
            ) : null}
          </TabsTrigger>
          {documentKind === "purchase_invoice" ? (
          <TabsTrigger value="history" className="min-h-10 px-3 py-2">
            سجل
          </TabsTrigger>
          ) : documentKind === "purchase_request" ? (
          <TabsTrigger value="history" className="min-h-10 px-3 py-2">
            مقدَّمة ({submitted.length})
          </TabsTrigger>
          ) : documentKind === "purchase_order" ? (
          <TabsTrigger value="history" className="min-h-10 px-3 py-2">
            محوَّلة ({invoiced.length})
          </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="drafts" className="mt-0">
          <InvoiceList
            items={drafts}
            currency={currency}
            emptyTitle="مفيش فواتير مؤقتة"
            emptyDescription="اضغط شراء جديد — هتفتح فاتورة كاملة تضيف فيها الأصناف وتستلم عشان المخزون يتحدّث."
            emptyAction={newPurchaseButton}
            onOpen={setEditingId}
            onPrintReceipt={openPurchaseReceipt}
          />
        </TabsContent>

        <TabsContent value="received" className="mt-0">
          <InvoiceList
            items={
              documentKind === "purchase_request"
                ? approved
                : documentKind === "purchase_order"
                  ? sent
                  : documentKind === "purchase_return"
                    ? posted
                    : received
            }
            currency={currency}
            emptyTitle="مفيش مستندات هنا"
            emptyDescription={description}
            emptyAction={allowCreate ? newPurchaseButton : undefined}
            onOpen={setEditingId}
            onPrintReceipt={openPurchaseReceipt}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          {documentKind === "purchase_invoice" ? (
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
                onPrintReceipt={openPurchaseReceipt}
              />
            </div>
          </div>
          ) : (
          <InvoiceList
            items={documentKind === "purchase_request" ? submitted : invoiced}
            currency={currency}
            emptyTitle="مفيش مستندات هنا"
            emptyDescription={description}
            onOpen={setEditingId}
            onPrintReceipt={openPurchaseReceipt}
          />
          )}
        </TabsContent>
      </Tabs>

      <DocumentPrintPreviewModal
        open={Boolean(printPreview)}
        onOpenChange={(open) => {
          if (!open) setPrintPreview(null);
        }}
        href={printPreview?.href ?? null}
        title={printPreview?.title}
      />
    </>
  );
}
