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
  { label: "Purchases", href: "/inventory/purchases", icon: Truck, accent: "#2563EB" },
  { label: "Suppliers", href: "/inventory/suppliers", icon: Landmark, accent: "#0D9488" },
  { label: "Transfers", href: "/inventory/transfers", icon: ArrowLeftRight, accent: "#8B5CF6" },
  { label: "Waste", href: "/inventory/waste", icon: Trash2, accent: "#DC2626" },
  { label: "Stock count", href: "/inventory/stock-count", icon: ClipboardList, accent: "#F59E0B" },
];

const productTypeFilters: { label: string; value?: ProductType }[] = [
  { label: "All", value: undefined },
  { label: "Finished", value: "finished" },
  { label: "Ingredients", value: "ingredient" },
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
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Stock health and movements for <span className="font-medium">{storeName}</span>
            {activeWarehouse ? ` · ${activeWarehouse.name}` : " · all warehouses"}
          </p>
        </div>
        <Link
          href="/inventory/movements"
          className="text-sm font-medium text-primary hover:underline"
        >
          Full movement log →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={inventoryHref(undefined, selectedProductType)}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            !selectedWarehouseId ? "border-primary bg-primary text-primary-foreground" : "border-border"
          }`}
        >
          All warehouses
        </Link>
        {warehouses.map((warehouse) => (
          <Link
            key={warehouse.id}
            href={inventoryHref(warehouse.id, selectedProductType)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
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
            className={`rounded-md border px-3 py-1.5 text-sm ${
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
          title="Health score"
          value={`${healthScore}%`}
          subtitle={healthLabel}
          icon={<Warehouse className="size-5" />}
          accent={healthScore >= 85 ? "#16A34A" : healthScore >= 60 ? "#F59E0B" : "#DC2626"}
        />
        <OperationalCard
          title="Tracked SKUs"
          value={String(totalSkus)}
          subtitle="Active inventory items"
          icon={<Package className="size-5" />}
          accent="#2563EB"
        />
        <OperationalCard
          title="Low stock"
          value={String(lowCount)}
          subtitle="At or below reorder point"
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
            value="Open"
            subtitle="Operational workflow"
            href={link.href}
            icon={<link.icon className="size-5" />}
            accent={link.accent}
          />
        ))}
      </div>

      <Tabs defaultValue="stock">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="stock">Stock by category</TabsTrigger>
          <TabsTrigger value="movements">Recent movements</TabsTrigger>
        </TabsList>
        <TabsContent value="stock" className="mt-4">
          <StockCards groups={stockGroups} />
        </TabsContent>
        <TabsContent value="movements" className="mt-4">
          <MovementTimeline movements={movements} compact />
        </TabsContent>
      </Tabs>
    </div>
  );
}
