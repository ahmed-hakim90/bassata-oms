"use client";

import { Printer } from "lucide-react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { StatusPill } from "@/components/Velora/status-pill";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { formatDateTime } from "@/lib/format";
import type { Category, Product, Store, Warehouse } from "@/lib/types";
import type { StockCountWithLines } from "@/modules/stock-count/services/count.service";
import { StockCountWizard } from "./stock-count-wizard";
import { StockCountSheetForm } from "./stock-count-sheet-form";
import { StockCountStartForm } from "./stock-count-start-form";

function statusLabel(status: StockCountWithLines["status"]) {
  switch (status) {
    case "completed":
      return { label: "مكتمل", variant: "success" as const };
    case "pending_approval":
      return { label: "بانتظار الاعتماد", variant: "warning" as const };
    case "approved":
      return { label: "معتمد", variant: "info" as const };
    default:
      return { label: "جارٍ العد", variant: "info" as const };
  }
}

interface StockCountPageProps {
  counts: StockCountWithLines[];
  activeCount: StockCountWithLines | null;
  products: Product[];
  warehouses: Warehouse[];
  printWarehouses: Warehouse[];
  stores: Store[];
  categories: Category[];
  storeId: string;
  canApprove: boolean;
  trackedProductCount: number;
  barcodeScannerEnabled: boolean;
}

export function StockCountPage({
  counts,
  activeCount,
  products,
  warehouses,
  printWarehouses,
  stores,
  categories,
  storeId,
  canApprove,
  trackedProductCount,
  barcodeScannerEnabled,
}: StockCountPageProps) {
  const router = useRouter();
  const warehouseNameById = new Map(printWarehouses.map((w) => [w.id, w.name]));

  return (
    <>
      <PageHeader
        title="جرد المخزون"
        description="جرد مخزن أو قسم أو منتج — بالسكانر من صفر، أو ورقة جرد للطباعة"
      />

      {activeCount ? (
        <StockCountWizard
          count={activeCount}
          products={products}
          categories={categories}
          canApprove={canApprove}
          trackedProductCount={trackedProductCount}
          barcodeScannerEnabled={barcodeScannerEnabled}
          onComplete={() => router.refresh()}
        />
      ) : (
        <div className="space-y-4">
          <StockCountStartForm
            warehouses={warehouses}
            categories={categories}
            products={products}
            barcodeScannerEnabled={barcodeScannerEnabled}
            onStarted={() => router.refresh()}
          />
          <StockCountSheetForm
            stores={stores}
            warehouses={printWarehouses}
            categories={categories}
            products={products}
            defaultStoreId={storeId}
          />
          {counts.length === 0 ? (
            <EmptyStateBlock
              title="لا توجد جردات سابقة"
              description="ابدأ جرد من الكارت فوق، أو اطبع ورقة وتعدّ على الأرض."
            />
          ) : (
            <OperationalCard title="الجردات السابقة" description={`${counts.length} جردة`}>
              <ul className="divide-y divide-border/60">
                {counts.map((c) => {
                  const status = statusLabel(c.status);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-[var(--mds-space-4)] py-[var(--mds-space-3)]"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          جرد #{c.id.slice(-6).toUpperCase()}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {warehouseNameById.get(c.warehouse_id) ?? "مخزن"}
                          {" · "}
                          {c.lines.length} صنف
                          {" · "}
                          بدأ {formatDateTime(c.started_at)}
                          {c.completed_at && ` · اكتمل ${formatDateTime(c.completed_at)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusPill label={status.label} variant={status.variant} />
                        <CompactActions>
                          <CompactAction
                            label="طباعة"
                            icon={Printer}
                            href={`/print/stock-count/${c.id}`}
                          />
                        </CompactActions>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </OperationalCard>
          )}
        </div>
      )}
    </>
  );
}
