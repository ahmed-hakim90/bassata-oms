"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { EmptyStateBlock, LoadingStateBlock } from "@/components/Velora/state-blocks";
import { DataTableShell } from "@/components/Velora/data-table-shell";
import { StatusPill } from "@/components/Velora/status-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { todayDocumentDate } from "@/lib/document-date";
import { selectLabelById } from "@/lib/select-label";
import type {
  Customer,
  Order,
  PaymentMethod,
  Product,
  ProductPriceTier,
  Warehouse,
} from "@/lib/types";
import {
  getSalesInvoiceCatalogAction,
  getSalesInvoiceDetailAction,
} from "@/modules/sales-invoices/actions/sales-invoice.actions";
import type { SalesInvoiceWithDetails } from "@/modules/sales-invoices/services/sales-invoice.service";
import { SalesInvoiceForm } from "./sales-invoice-form";

const LOCAL_DRAFT_PREFIX = "local-";

function buildLocalSalesDraft(input: {
  documentKind: NonNullable<Order["document_kind"]>;
  warehouseId: string;
  customerId: string | null;
  customers: Customer[];
  warehouses: Warehouse[];
}): SalesInvoiceWithDetails {
  const warehouse = input.warehouses.find((w) => w.id === input.warehouseId);
  const customer = input.customerId
    ? input.customers.find((c) => c.id === input.customerId)
    : null;
  const now = new Date().toISOString();
  return {
    id: `${LOCAL_DRAFT_PREFIX}${crypto.randomUUID()}`,
    store_id: "",
    session_id: null,
    order_number: "مسودة جديدة",
    customer_id: input.customerId,
    status: "completed",
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    payment_status: "unpaid",
    created_by: "",
    created_at: now,
    sales_mode: "wholesale",
    document_status: "draft",
    document_kind: input.documentKind,
    source_document_id: null,
    document_notes: "",
    document_date: todayDocumentDate(),
    warehouse_id: input.warehouseId,
    valid_until: null,
    lines: [],
    customerName: customer?.name ?? null,
    warehouseName: warehouse?.name ?? null,
  };
}

interface SalesInvoicesPageProps {
  invoices: SalesInvoiceWithDetails[];
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  wholesaleTiersByProductId: Record<string, ProductPriceTier[]>;
  currency: string;
  enabledPaymentMethods: PaymentMethod[];
  canCorrectCosts?: boolean;
  canManagePrintEngine?: boolean;
  documentKind?: NonNullable<Order["document_kind"]>;
  basePath?: string;
  title?: string;
  description?: string;
  createLabel?: string;
  allowCreate?: boolean;
}

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  issued: "صادرة",
  delivered: "مُسلَّمة",
  sent: "مُرسل",
  accepted: "مقبول",
  rejected: "مرفوض",
  expired: "منتهي",
  confirmed: "مؤكد",
  cancelled: "ملغي",
  invoiced: "مفوتر",
};

const statusVariant: Record<string, "draft" | "info" | "success" | "danger" | "warning"> = {
  draft: "draft",
  issued: "info",
  delivered: "success",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  expired: "warning",
  confirmed: "info",
  cancelled: "danger",
  invoiced: "success",
};

export function SalesInvoicesPage({
  invoices: initial,
  customers,
  products: initialProducts,
  warehouses,
  wholesaleTiersByProductId: initialTiers,
  currency,
  enabledPaymentMethods,
  canCorrectCosts = false,
  canManagePrintEngine = false,
  documentKind = "sales_invoice",
  basePath = "/sales-invoices",
  title = "فواتير المبيعات",
  description = "مسودة → إصدار → تسليم وخصم مخزون",
  createLabel = "فاتورة جديدة",
  allowCreate = true,
}: SalesInvoicesPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openFromQuery = searchParams.get("open");
  const createFromQuery = searchParams.get("create") === "1";
  const [, startTransition] = useTransition();
  const [invoices, setInvoices] = useState(initial);
  const [products, setProducts] = useState(initialProducts);
  const [wholesaleTiersByProductId, setWholesaleTiersByProductId] = useState(initialTiers);
  const [activeId, setActiveId] = useState<string | null>(openFromQuery);
  const [openBootstrapped, setOpenBootstrapped] = useState(false);
  const [createBootstrapped, setCreateBootstrapped] = useState(false);
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ""
  );
  const [customerId, setCustomerId] = useState<string>("__none__");

  useEffect(() => {
    setInvoices(initial);
  }, [initial]);

  useEffect(() => {
    setProducts(initialProducts);
    setWholesaleTiersByProductId(initialTiers);
  }, [initialProducts, initialTiers]);

  const catalogFetchedAtRef = useRef(0);
  const formOpenRef = useRef(Boolean(openFromQuery));
  const refreshCatalog = useCallback((force = false) => {
    const now = Date.now();
    // Avoid hammering: focus + visibility + open were firing 3× (~2–3s each).
    if (!force && now - catalogFetchedAtRef.current < 45_000) return;
    catalogFetchedAtRef.current = now;
    void getSalesInvoiceCatalogAction().then((result) => {
      if (!result.ok) return;
      setProducts(result.data.products);
      setWholesaleTiersByProductId(result.data.wholesaleTiersByProductId);
    });
  }, []);

  const startDraftCreate = useCallback(
    (defaults: { warehouseId: string; customerId: string | null }) => {
      if (!defaults.warehouseId) {
        toast.error("اختار المخزن");
        return;
      }
      if (warehouses.length === 0) {
        toast.error("مفيش مخزن متاح — راجع إعدادات الفرع");
        return;
      }
      formOpenRef.current = true;
      const local = buildLocalSalesDraft({
        documentKind,
        warehouseId: defaults.warehouseId,
        customerId: defaults.customerId,
        customers,
        warehouses,
      });
      // افتح الوثيقة فورًا — المسودة تتسجل على السيرفر عند أول صنف/حفظ/استدعاء
      setInvoices((prev) => [
        local,
        ...prev.filter((invoice) => !invoice.id.startsWith(LOCAL_DRAFT_PREFIX)),
      ]);
      setActiveId(local.id);
      refreshCatalog(true);
    },
    [refreshCatalog, warehouses, customers, documentKind]
  );

  // Pick up product/tier price edits after leaving the tab (throttled).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") refreshCatalog();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshCatalog]);

  useEffect(() => {
    if (!openFromQuery || openBootstrapped) return;
    setOpenBootstrapped(true);
    formOpenRef.current = true;
    setActiveId(openFromQuery);
    const inList = initial.some((inv) => inv.id === openFromQuery);
    if (inList) {
      router.replace(basePath, { scroll: false });
      return;
    }
    startTransition(async () => {
      const detail = await getSalesInvoiceDetailAction(openFromQuery);
      if (!detail.ok) {
        toast.error(detail.error);
        router.replace(basePath, { scroll: false });
        return;
      }
      setInvoices((prev) => [detail.data, ...prev.filter((i) => i.id !== detail.data.id)]);
      setActiveId(detail.data.id);
      router.replace(basePath, { scroll: false });
    });
  }, [openFromQuery, openBootstrapped, initial, router, startTransition]);

  useEffect(() => {
    if (!createFromQuery || createBootstrapped || openFromQuery) return;
    setCreateBootstrapped(true);
    const nextWarehouseId =
      warehouseId || warehouses.find((w) => w.is_default)?.id || warehouses[0]?.id || "";
    if (!nextWarehouseId) {
      toast.error("اختار المخزن أولاً");
      router.replace(basePath, { scroll: false });
      return;
    }
    startDraftCreate({ warehouseId: nextWarehouseId, customerId: null });
    router.replace(basePath, { scroll: false });
  }, [
    createFromQuery,
    createBootstrapped,
    openFromQuery,
    warehouseId,
    warehouses,
    router,
    startDraftCreate,
  ]);

  const active = useMemo(
    () => invoices.find((inv) => inv.id === activeId) ?? null,
    [invoices, activeId]
  );

  const drafts = invoices.filter((i) => i.document_status === "draft");
  const issued = invoices.filter((i) => i.document_status === "issued");
  const delivered = invoices.filter((i) => i.document_status === "delivered");
  const sent = invoices.filter((i) => i.document_status === "sent");
  const accepted = invoices.filter((i) => i.document_status === "accepted");
  const confirmed = invoices.filter((i) => i.document_status === "confirmed");
  const invoiced = invoices.filter((i) => i.document_status === "invoiced");
  const rejected = invoices.filter((i) => i.document_status === "rejected");

  const tabs =
    documentKind === "quotation"
      ? [
          { id: "drafts", label: "مسودات", rows: drafts },
          { id: "sent", label: "مُرسلة", rows: sent },
          { id: "accepted", label: "مقبولة", rows: accepted },
          { id: "rejected", label: "مرفوضة", rows: rejected },
        ]
      : documentKind === "sales_order"
        ? [
            { id: "drafts", label: "مسودات", rows: drafts },
            { id: "confirmed", label: "مؤكدة", rows: confirmed },
            { id: "invoiced", label: "مفوترة", rows: invoiced },
          ]
        : documentKind === "credit_note"
          ? [
              { id: "drafts", label: "مسودات", rows: drafts },
              { id: "issued", label: "صادرة", rows: issued },
            ]
          : [
              { id: "drafts", label: "مسودات", rows: drafts },
              { id: "issued", label: "صادرة", rows: issued },
              { id: "delivered", label: "مُسلَّمة", rows: delivered },
            ];

  function closeForm() {
    formOpenRef.current = false;
    setInvoices((prev) => prev.filter((i) => !i.id.startsWith(LOCAL_DRAFT_PREFIX)));
    setActiveId(null);
  }

  function openNewDraft() {
    if (!warehouseId) {
      toast.error("اختار المخزن");
      return;
    }
    startDraftCreate({
      warehouseId,
      customerId: customerId === "__none__" ? null : customerId,
    });
  }

  function upsertInvoice(
    next: SalesInvoiceWithDetails | null,
    options?: { removedId?: string; refresh?: boolean }
  ) {
    if (next === null) {
      if (options?.removedId) {
        setInvoices((prev) => prev.filter((i) => i.id !== options.removedId));
      }
      closeForm();
      if (options?.refresh !== false) router.refresh();
      return;
    }
    setInvoices((prev) => {
      const others = prev.filter(
        (i) => i.id !== next.id && !i.id.startsWith(LOCAL_DRAFT_PREFIX)
      );
      return [next, ...others];
    });
    if (formOpenRef.current) setActiveId(next.id);
    if (options?.refresh) router.refresh();
  }

  function InvoiceCards({ rows }: { rows: SalesInvoiceWithDetails[] }) {
    if (rows.length === 0) {
      return <EmptyStateBlock title={`مفيش ${title} هنا`} description={description} />;
    }
    return (
      <DataTableShell title={`${title} (${rows.length})`} scrollable={false}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((invoice) => (
            <MobileEntityCard
              key={invoice.id}
              title={invoice.order_number}
              subtitle={invoice.customerName ?? "بدون عميل"}
              badge={
                <StatusPill
                  label={statusLabels[invoice.document_status ?? "draft"]}
                  variant={statusVariant[invoice.document_status ?? "draft"]}
                />
              }
              fields={[
                {
                  label: "التاريخ",
                  value: formatDateTime(
                    invoice.document_date
                      ? `${invoice.document_date}T12:00:00.000Z`
                      : invoice.created_at
                  ),
                },
                {
                  label: "الإجمالي",
                  value: (
                    <span className="tabular-nums font-semibold">
                      {formatCurrency(invoice.total, currency)}
                    </span>
                  ),
                },
              ]}
              footer={
                <CompactActions className="w-full justify-end">
                  <CompactAction
                    label="فتح"
                    icon={Pencil}
                    onClick={() => {
                      formOpenRef.current = true;
                      setActiveId(invoice.id);
                      refreshCatalog(true);
                    }}
                  />
                </CompactActions>
              }
            />
          ))}
        </div>
      </DataTableShell>
    );
  }

  if (active) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader
          breadcrumb={<span>المبيعات · {title}</span>}
          title={title}
          description={description}
        />
        <SalesInvoiceForm
          invoice={active}
          customers={customers}
          products={products}
          warehouses={warehouses}
          wholesaleTiersByProductId={wholesaleTiersByProductId}
          currency={currency}
          enabledPaymentMethods={enabledPaymentMethods}
          canCorrectCosts={canCorrectCosts}
          canManagePrintEngine={canManagePrintEngine}
          documentKind={documentKind}
          onClose={() => {
            closeForm();
            router.refresh();
          }}
          onChanged={(next, options) => {
            if (next === null) {
              upsertInvoice(null, {
                removedId: active.id,
                refresh: options?.refresh ?? true,
              });
              return;
            }
            upsertInvoice(next, { refresh: options?.refresh ?? false });
          }}
        />
      </div>
    );
  }

  if (activeId && !active) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader
          breadcrumb={<span>المبيعات · {title}</span>}
          title={title}
          description="جاري فتح المستند"
        />
        <LoadingStateBlock label="جاري فتح الفاتورة" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        breadcrumb={<span>المبيعات · {title}</span>}
        title={title}
        description={description}
        action={
          allowCreate ? (
          <div className="flex w-full flex-row flex-wrap items-end gap-2 sm:w-auto">
            <div className="space-y-1">
              <Label htmlFor="new-invoice-warehouse" className="text-xs">المخزن</Label>
              <Select value={warehouseId || undefined} onValueChange={(v) => setWarehouseId(v ?? "")}>
                <SelectTrigger id="new-invoice-warehouse" className="h-11 w-[min(100%,11rem)] sm:h-9 sm:w-44">
                  <SelectValue placeholder="المخزن">
                    {(value) => selectLabelById(warehouses, value, (w) => w.name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id} label={w.name}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-invoice-customer" className="text-xs">عميل</Label>
              <Select value={customerId || undefined} onValueChange={(v) => setCustomerId(v ?? "__none__")}>
                <SelectTrigger id="new-invoice-customer" className="h-11 w-[min(100%,11rem)] sm:h-9 sm:w-44">
                  <SelectValue placeholder="عميل">
                    {(value) =>
                      value === "__none__"
                        ? "بدون عميل"
                        : selectLabelById(customers, value, (c) => c.name)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" label="بدون عميل">
                    بدون عميل
                  </SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id} label={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="h-11 shrink-0 sm:h-9"
              disabled={!warehouseId}
              aria-label="مسودة جديدة"
              onClick={openNewDraft}
            >
              <Plus className="size-4" />
              <span className="sr-only sm:not-sr-only">{createLabel}</span>
            </Button>
          </div>
          ) : undefined
        }
      />

      <Tabs defaultValue={tabs[0]?.id ?? "drafts"}>
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1 sm:inline-flex sm:w-fit">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="min-h-10 px-2 py-2 text-xs sm:text-sm">
              {tab.label} ({tab.rows.length})
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            <InvoiceCards rows={tab.rows} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
