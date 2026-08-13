"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/Velora/page-header";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
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
import { selectLabelById } from "@/lib/select-label";
import type {
  Customer,
  PaymentMethod,
  Product,
  ProductPriceTier,
  Warehouse,
} from "@/lib/types";
import {
  createSalesInvoiceAction,
  getSalesInvoiceCatalogAction,
  getSalesInvoiceDetailAction,
} from "@/modules/sales-invoices/actions/sales-invoice.actions";
import type { SalesInvoiceWithDetails } from "@/modules/sales-invoices/services/sales-invoice.service";
import { SalesInvoiceForm } from "./sales-invoice-form";

interface SalesInvoicesPageProps {
  invoices: SalesInvoiceWithDetails[];
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  wholesaleTiersByProductId: Record<string, ProductPriceTier[]>;
  currency: string;
  enabledPaymentMethods: PaymentMethod[];
  canCorrectCosts?: boolean;
}

const statusLabels = {
  draft: "مسودة",
  issued: "صادرة",
  delivered: "مُسلَّمة",
} as const;

const statusVariant = {
  draft: "draft",
  issued: "info",
  delivered: "success",
} as const;

export function SalesInvoicesPage({
  invoices: initial,
  customers,
  products: initialProducts,
  warehouses,
  wholesaleTiersByProductId: initialTiers,
  currency,
  enabledPaymentMethods,
  canCorrectCosts = false,
}: SalesInvoicesPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openFromQuery = searchParams.get("open");
  const [pending, startTransition] = useTransition();
  const [invoices, setInvoices] = useState(initial);
  const [products, setProducts] = useState(initialProducts);
  const [wholesaleTiersByProductId, setWholesaleTiersByProductId] = useState(initialTiers);
  const [activeId, setActiveId] = useState<string | null>(openFromQuery);
  const [openBootstrapped, setOpenBootstrapped] = useState(false);
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
    setActiveId(openFromQuery);
    const inList = initial.some((inv) => inv.id === openFromQuery);
    if (inList) {
      router.replace("/sales-invoices", { scroll: false });
      return;
    }
    startTransition(async () => {
      const detail = await getSalesInvoiceDetailAction(openFromQuery);
      if (!detail.ok) {
        toast.error(detail.error);
        router.replace("/sales-invoices", { scroll: false });
        return;
      }
      setInvoices((prev) => [detail.data, ...prev.filter((i) => i.id !== detail.data.id)]);
      setActiveId(detail.data.id);
      router.replace("/sales-invoices", { scroll: false });
    });
  }, [openFromQuery, openBootstrapped, initial, router, startTransition]);

  const active = useMemo(
    () => invoices.find((inv) => inv.id === activeId) ?? null,
    [invoices, activeId]
  );

  const drafts = invoices.filter((i) => i.document_status === "draft");
  const issued = invoices.filter((i) => i.document_status === "issued");
  const delivered = invoices.filter((i) => i.document_status === "delivered");

  function upsertInvoice(
    next: SalesInvoiceWithDetails | null,
    options?: { removedId?: string; refresh?: boolean }
  ) {
    if (next === null) {
      if (options?.removedId) {
        setInvoices((prev) => prev.filter((i) => i.id !== options.removedId));
        setActiveId(null);
      }
      if (options?.refresh !== false) router.refresh();
      return;
    }
    setInvoices((prev) => {
      const idx = prev.findIndex((i) => i.id === next.id);
      if (idx === -1) return [next, ...prev];
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
    if (options?.refresh) router.refresh();
  }

  function InvoiceCards({ rows }: { rows: SalesInvoiceWithDetails[] }) {
    if (rows.length === 0) {
      return <EmptyStateBlock title="مفيش فواتير هنا" description="ابدأ بمسودة جديدة للجملة" />;
    }
    return (
      <DataTableShell title={`الفواتير (${rows.length})`} scrollable={false}>
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
                <Button
                  type="button"
                  className="h-11 w-full sm:w-auto"
                  variant="outline"
                  onClick={() => {
                    refreshCatalog(true);
                    setActiveId(invoice.id);
                  }}
                >
                  <Pencil className="size-3.5" />
                  فتح
                </Button>
              }
            />
          ))}
        </div>
      </DataTableShell>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        breadcrumb={<span>المبيعات · فواتير الجملة</span>}
        title="فواتير المبيعات"
        description="مسودة → إصدار → تسليم (خصم المخزون عند التسليم — مستقلة عن جلسة الكاشير)"
        action={
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
              disabled={pending || !warehouseId}
              aria-label="مسودة جديدة"
              onClick={() =>
                startTransition(async () => {
                  refreshCatalog(true);
                  const result = await createSalesInvoiceAction({
                    warehouseId,
                    customerId: customerId === "__none__" ? null : customerId,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("اتعملت مسودة");
                  setInvoices((prev) => [
                    result.data,
                    ...prev.filter((i) => i.id !== result.data.id),
                  ]);
                  setActiveId(result.data.id);
                })
              }
            >
              <Plus className="size-4" />
              <span className="sr-only sm:not-sr-only">مسودة جديدة</span>
            </Button>
          </div>
        }
      />

      {active ? (
        <SalesInvoiceForm
          invoice={active}
          customers={customers}
          products={products}
          warehouses={warehouses}
          wholesaleTiersByProductId={wholesaleTiersByProductId}
          currency={currency}
          enabledPaymentMethods={enabledPaymentMethods}
          canCorrectCosts={canCorrectCosts}
          onClose={() => setActiveId(null)}
          onChanged={(next, options) => {
            if (next === null) {
              upsertInvoice(null, { removedId: active.id, refresh: options?.refresh ?? true });
              return;
            }
            upsertInvoice(next, { refresh: options?.refresh ?? false });
          }}
        />
      ) : null}

      <Tabs defaultValue="drafts">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1 sm:inline-flex sm:w-fit">
          <TabsTrigger value="drafts" className="min-h-10 px-2 py-2 text-xs sm:text-sm">
            مسودات ({drafts.length})
          </TabsTrigger>
          <TabsTrigger value="issued" className="min-h-10 px-2 py-2 text-xs sm:text-sm">
            صادرة ({issued.length})
          </TabsTrigger>
          <TabsTrigger value="delivered" className="min-h-10 px-2 py-2 text-xs sm:text-sm">
            مُسلَّمة ({delivered.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="drafts" className="mt-4">
          <InvoiceCards rows={drafts} />
        </TabsContent>
        <TabsContent value="issued" className="mt-4">
          <InvoiceCards rows={issued} />
        </TabsContent>
        <TabsContent value="delivered" className="mt-4">
          <InvoiceCards rows={delivered} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
