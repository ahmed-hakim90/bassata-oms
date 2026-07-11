import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { formatCurrency } from "@/lib/format";
import type { TopProduct } from "@/modules/dashboard/services/dashboard.service";

interface TopProductsRankingProps {
  products: TopProduct[];
  currency?: string;
}

export function TopProductsRanking({ products, currency }: TopProductsRankingProps) {
  const max = products[0]?.revenue ?? 1;

  return (
    <div className="rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-5)] text-card-foreground shadow-[var(--mds-elevation-1)]">
      <h3 className="mb-[var(--mds-space-4)] font-heading text-sm font-semibold">أفضل المنتجات</h3>
      {products.length === 0 ? (
        <EmptyStateBlock
          title="مفيش بيانات مبيعات لسة"
          className="p-[var(--mds-space-4)]"
        />
      ) : (
        <ul className="space-y-3">
          {products.map((p, i) => (
            <li key={p.productId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                  {p.name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatCurrency(p.revenue, currency)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(p.revenue / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
