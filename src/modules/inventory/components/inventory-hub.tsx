"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  ClipboardList,
  Landmark,
  Package,
  Trash2,
  Truck,
  Warehouse,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { StockCards, type StockCategoryGroup } from "./stock-cards";
import { MovementTimeline } from "./movement-timeline";
import { LowStockStrip } from "./low-stock-strip";
import { ExpiryAlertStrip } from "./expiry-alert-strip";
import { ReorderSuggestions } from "./reorder-suggestions";
import type { MovementTimelineItem } from "../services/movement.service";
import type { InventoryAlert } from "../services/alert.service";
import type { ExpiryBatchAlert } from "../services/expiry.service";
import type { ReorderSuggestion } from "../services/reorder.service";
import type { Warehouse as WarehouseType, ProductType } from "@/lib/types";

const quickLinks = [
  { label: "مشتريات", href: "/inventory/purchases", icon: Truck, accent: "#2563EB" },
  { label: "موردين", href: "/inventory/suppliers", icon: Landmark, accent: "#0D9488" },
  { label: "تحويلات", href: "/inventory/transfers", icon: ArrowLeftRight, accent: "#8B5CF6" },
  { label: "هالك", href: "/inventory/waste", icon: Trash2, accent: "#DC2626" },
  { label: "جرد", href: "/inventory/stock-count", icon: ClipboardList, accent: "#F59E0B" },
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المخزون"
        description={`صحة المخزون والحركة لفرع ${storeName}${
          activeWarehouse ? ` · ${activeWarehouse.name}` : " · كل المخازن"
        }`}
        action={
          <Link
            href="/inventory/movements"
            className="text-sm font-medium text-primary hover:underline"
          >
            سجل الحركة الكامل
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href={inventoryHref(undefined, selectedProductType)}
          className={`rounded-xl border px-3 py-2 text-sm ${
            !selectedWarehouseId ? "border-primary bg-primary text-primary-foreground" : "border-border"
          }`}
        >
          كل المخازن
        </Link>
        {warehouses.map((warehouse) => (
          <Link
            key={warehouse.id}
            href={inventoryHref(warehouse.id, selectedProductType)}
            className={`rounded-xl border px-3 py-2 text-sm ${
              selectedWarehouseId === warehouse.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border"
            }`}
          >
            {warehouse.name}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {productTypeFilters.map(({ label, value }) => (
          <Link
            key={label}
            href={inventoryHref(selectedWarehouseId, value)}
            className={`rounded-xl border px-3 py-2 text-sm ${
              selectedProductType === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <OperationalCard
          title="مؤشر الصحة"
          value={`${healthScore}%`}
          subtitle={healthLabel}
          icon={<Warehouse className="size-5" />}
          accent={healthScore >= 85 ? "#16A34A" : healthScore >= 60 ? "#F59E0B" : "#DC2626"}
        />
        <OperationalCard
          title="أصناف متتبعة"
          value={String(totalSkus)}
          subtitle="عناصر مخزون نشطة"
          icon={<Package className="size-5" />}
          accent="#2563EB"
        />
        <OperationalCard
          title="مخزون منخفض"
          value={String(lowCount)}
          subtitle="عند أو تحت حد إعادة الطلب"
          accent="#F59E0B"
          href="/products"
        />
      </div>

      <LowStockStrip alerts={alerts} />

      <ExpiryAlertStrip alerts={expiryAlerts} />

      <ReorderSuggestions suggestions={reorderSuggestions} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link) => (
          <OperationalCard
            key={link.href}
            title={link.label}
            value="فتح"
            subtitle="إجراء تشغيلي"
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
