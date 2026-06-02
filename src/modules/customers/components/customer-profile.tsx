"use client";

import Link from "next/link";
import { Heart, Receipt, ShoppingBag } from "lucide-react";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { LoyaltyLedgerEntry } from "@/lib/types";
import type { CustomerProfile } from "@/modules/customers/services/customer.service";

interface CustomerProfileViewProps {
  profile: CustomerProfile;
  ledger: LoyaltyLedgerEntry[];
}

export function CustomerProfileView({ profile, ledger }: CustomerProfileViewProps) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Spent"
          value={formatCurrency(profile.total_spent)}
          icon={<ShoppingBag className="size-5" />}
        />
        <KpiCard label="Visits" value={String(profile.visit_count)} />
        <KpiCard
          label="Avg Order"
          value={formatCurrency(profile.avgOrderValue)}
        />
        <KpiCard
          label="Loyalty Points"
          value={String(profile.loyaltyBalance)}
          icon={<Heart className="size-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <OperationalCard title="Favorite Products">
          {profile.favoriteProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No order history yet</p>
          ) : (
            <ul className="space-y-2">
              {profile.favoriteProducts.map((f) => (
                <li
                  key={f.productId}
                  className="flex justify-between rounded-2xl bg-muted/50 px-4 py-2"
                >
                  <span>{f.name}</span>
                  <span className="text-muted-foreground">{f.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </OperationalCard>

        <OperationalCard title="Recent Orders">
          {profile.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet</p>
          ) : (
            <ul className="space-y-2">
              {profile.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="flex items-center justify-between rounded-2xl px-4 py-2 hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2">
                      <Receipt className="size-4 text-muted-foreground" />
                      {o.order_number}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(o.total)}
                    </span>
                  </Link>
                  <p className="px-4 text-xs text-muted-foreground">
                    {formatDateTime(o.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </OperationalCard>
      </div>

      <OperationalCard title="Loyalty Ledger">
        <ul className="divide-y">
          {ledger.map((e) => (
            <li key={e.id} className="flex justify-between py-2">
              <span className="text-sm">{e.reason}</span>
              <span
                className={
                  e.points_delta >= 0 ? "text-emerald-600" : "text-red-600"
                }
              >
                {e.points_delta >= 0 ? "+" : ""}
                {e.points_delta} ({e.balance_after} bal)
              </span>
            </li>
          ))}
        </ul>
      </OperationalCard>

      {profile.notes && (
        <OperationalCard title="Notes">
          <p className="text-sm text-muted-foreground">{profile.notes}</p>
        </OperationalCard>
      )}
    </div>
  );
}
