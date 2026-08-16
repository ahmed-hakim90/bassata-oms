"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  Landmark,
  Package,
  ScrollText,
  Trash2,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationalCard } from "@/components/Velora/operational-card";
import { PageHeader } from "@/components/Velora/page-header";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { StockCards, type StockCategoryGroup } from "./stock-cards";
import { MovementTimeline } from "./movement-timeline";
import { LowStockStrip } from "./low-stock-strip";
import { ExpiryAlertStrip } from "./expiry-alert-strip";
import { ReorderSuggestions } from "./reorder-suggestions";
import { aggregateMovementTypeCounts } from "@/modules/inventory/lib/movement-type-labels";
import type { MovementTimelineItem } from "../services/movement.service";
import type { InventoryAlert } from "../services/alert.service";
import type { ExpiryBatchAlert } from "../services/expiry.service";
import type { ReorderSuggestion } from "../services/reorder.service";
import type { Warehouse as WarehouseType, ProductType } from "@/lib/types";
import { useMemo } from "react";

const quickLinks = [
  { label: "مشتريات", subtitle: "فواتير الموردين", href: "/inventory/purchases", icon: Truck, accent: "var(--mds-color-action-primary)" },
  { label: "طلب شراء", subtitle: "اعتماد داخلي", href: "/inventory/purchase-requests", icon: ClipboardList, accent: "var(--mds-color-action-primary-hover)" },
  { label: "أمر توريد", subtitle: "طلب من المورد", href: "/inventory/purchase-orders", icon: FileSpreadsheet, accent: "var(--mds-color-feedback-info)" },
  { label: "مرتجع شراء", subtitle: "إرجاع للمورد", href: "/inventory/purchase-returns", icon: ScrollText, accent: "var(--mds-color-feedback-danger)" },
  { label: "موردين", subtitle: "كشوف الحساب", href: "/inventory/suppliers", icon: Landmark, accent: "var(--mds-color-feedback-info)" },
  { label: "تحويلات", subtitle: "نقل بين الفروع", href: "/inventory/transfers", icon: ArrowLeftRight, accent: "var(--mds-color-action-primary-hover)" },
  { label: "هالك", subtitle: "الفاقد والتالف", href: "/inventory/waste", icon: Trash2, accent: "var(--mds-color-feedback-danger)" },
  { label: "جرد", subtitle: "تسوية المخزون", href: "/inventory/stock-count", icon: ClipboardList, accent: "var(--mds-color-feedback-warning)" },
];

const productTypeFilters: { label: string; value?: ProductType }[] = [
  { label: "الكل", value: undefined },
  { label: "تام", value: "finished" },
  { label: "خامات", value: "ingredient" },
];

function inventoryHref(warehouseId?: string, productType?: ProductType) {
  const params = new URLSearchParams();
  if (warehouseId) params.set("warehouse", warehouseId);
  if (productType) params.set("type", productType);
  const query = params.toString();
  return query ? `/inventory?${query}` : "/inventory";
}

interface InventoryHubProps {
  storeName: string;
  healthScore: number;
  healthLabel: string;
  lowCount: number;
  totalSkus: number;
  stockGroups: StockCategoryGroup[];
  alerts: InventoryAlert[];
  expiryAlerts: ExpiryBatchAlert[];
  movements: MovementTimelineItem[];
  reorderSuggestions: ReorderSuggestion[];
  warehouses: WarehouseType[];
  selectedWarehouseId?: string;
  selectedProductType?: ProductType;
}

export function InventoryHub({
  storeName,
  healthScore,
  healthLabel,
  lowCount,
  totalSkus,
  stockGroups,
  alerts,
  expiryAlerts,
  movements,
  reorderSuggestions,
  warehouses,
  selectedWarehouseId,
  selectedProductType,
}: InventoryHubProps) {
  const activeWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);
  const hasStock = stockGroups.some((group) => group.items.length > 0);
  const movementChart = useMemo(
    () =>
      aggregateMovementTypeCounts(movements).map((row) => ({
        label: row.label,
        count: row.count,
      })),
    [movements]
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        breadcrumb={<span>المخزون</span>}
        title="المخزون"
        description={`صحة المخزون والحركة لفرع ${storeName}${
          activeWarehouse ? ` · ${activeWarehouse.name}` : " · كل المخازن"
        }. ابدأ من المشتريات أو الجرد حسب المطلوب.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/reports/product-card"
              className="text-sm font-medium text-primary hover:underline"
            >
              كارت صنف
            </Link>
            <Link
              href="/inventory/movements"
              className="text-sm font-medium text-primary hover:underline"
            >
              سجل الحركة الكامل
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-3 rounded-[var(--mds-radius-lg)] border border-border bg-card px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="shrink-0 text-xs font-medium text-muted-foreground sm:min-w-[4.5rem]">
            المخزن
          </span>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <Link
              href={inventoryHref(undefined, selectedProductType)}
              className={`shrink-0 rounded-[var(--mds-radius-md)] border px-3 py-2 text-sm transition-colors touch-manipulation ${
                !selectedWarehouseId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/40 hover:bg-muted"
              }`}
            >
              الكل
            </Link>
            {warehouses.map((warehouse) => (
              <Link
                key={warehouse.id}
                href={inventoryHref(warehouse.id, selectedProductType)}
                className={`shrink-0 rounded-[var(--mds-radius-md)] border px-3 py-2 text-sm transition-colors touch-manipulation ${
                  selectedWarehouseId === warehouse.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                {warehouse.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="shrink-0 text-xs font-medium text-muted-foreground sm:min-w-[4.5rem]">
            النوع
          </span>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {productTypeFilters.map(({ label, value }) => (
              <Link
                key={label}
                href={inventoryHref(selectedWarehouseId, value)}
                className={`shrink-0 rounded-[var(--mds-radius-md)] border px-3 py-2 text-sm transition-colors touch-manipulation ${
                  selectedProductType === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <OperationalCard
          title="مؤشر الصحة"
          value={`${healthScore}%`}
          subtitle={healthLabel}
          icon={<Warehouse className="size-5" />}
          accent={
            healthScore >= 85
              ? "var(--mds-color-feedback-success)"
              : healthScore >= 60
                ? "var(--mds-color-feedback-warning)"
                : "var(--mds-color-feedback-danger)"
          }
        />
        <OperationalCard
          title="أصناف متتبعة"
          value={String(totalSkus)}
          subtitle="عناصر مخزون نشطة"
          icon={<Package className="size-5" />}
        />
        <OperationalCard
          title="مخزون منخفض"
          value={String(lowCount)}
          subtitle="عند أو تحت حد إعادة الطلب"
          accent="var(--mds-color-feedback-warning)"
          href="/products"
        />
      </div>

      {movementChart.length > 0 ? (
        <ReportChartSection title="أحدث الحركات حسب النوع" height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={movementChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0F766E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartSection>
      ) : null}

      <ModuleAnalyticsQuickLinks
        title="تحليل المخزون"
        description="تقارير وتفاصيل سريعة"
        links={[
          {
            href: "/reports/inventory",
            label: "تقرير المخزون",
            description: "تقييم وتشغيلات وانتهاء",
            icon: Warehouse,
          },
          {
            href: "/reports/product-card",
            label: "كارت صنف",
            description: "جه وطلع والمتاح على فترة",
            icon: ClipboardList,
          },
          {
            href: "/reports/sales/product",
            label: "مبيعات منتج",
            description: "إيراد وكمية لصنف واحد",
            icon: BarChart3,
          },
          {
            href: "/reports/replenishment",
            label: "إعادة الطلب",
            description: "قد إيه تشتري حسب الاستهلاك",
            icon: Package,
          },
          {
            href: "/inventory/suppliers",
            label: "الموردين",
            description: "مستحقات وكشف حساب",
            icon: Landmark,
          },
        ]}
      />

      <LowStockStrip alerts={alerts} />

      <ExpiryAlertStrip alerts={expiryAlerts} />

      <ReorderSuggestions suggestions={reorderSuggestions} />

      <div className="grid gap-[var(--mds-space-3)] sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link) => (
          <OperationalCard
            key={link.href}
            title={link.label}
            value={link.subtitle}
            href={link.href}
            icon={<link.icon className="size-5" />}
            accent={link.accent}
          />
        ))}
      </div>

      <Tabs defaultValue="stock">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="stock">المخزون حسب الفئة</TabsTrigger>
          <TabsTrigger value="movements">أحدث الحركات</TabsTrigger>
        </TabsList>
        <TabsContent value="stock" className="mt-4">
          {hasStock ? (
            <StockCards groups={stockGroups} />
          ) : (
            <EmptyStateBlock
              title="لا يوجد مخزون معروض"
              description="أضف أصناف متتبعة أو استلم مشتريات لبدء تتبع المخزون."
              ctaHref="/products"
              ctaLabel="إدارة الأصناف"
            />
          )}
        </TabsContent>
        <TabsContent value="movements" className="mt-4">
          {movements.length > 0 ? (
            <MovementTimeline movements={movements} compact />
          ) : (
            <EmptyStateBlock
              title="لا توجد حركات بعد"
              description="ستظهر هنا عمليات الاستلام والتحويل والهالك والجرد."
              ctaHref="/inventory/purchases"
              ctaLabel="فتح المشتريات"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
