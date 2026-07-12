"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { LoyaltyLedgerEntry } from "@/lib/types";
import type { CustomerProfile } from "@/modules/customers/services/customer.service";

interface CustomerProfileViewProps {
  profile: CustomerProfile;
  ledger: LoyaltyLedgerEntry[];
}

export function CustomerProfileView({ profile, ledger }: CustomerProfileViewProps) {
  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-2">
        <OperationalCard title="المنتجات المفضلة">
          {profile.favoriteProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">مفيش سجل طلبات لسة</p>
          ) : (
            <ul className="flex flex-col gap-[var(--mds-space-2)]">
              {profile.favoriteProducts.map((f) => (
                <li
                  key={f.productId}
                  className="flex justify-between rounded-[var(--mds-radius-md)] bg-muted/50 px-[var(--mds-space-4)] py-[var(--mds-space-2)]"
                >
                  <span>{f.name}</span>
                  <span className="text-muted-foreground tabular-nums">{f.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </OperationalCard>

        <OperationalCard title="آخر الطلبات">
          {profile.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">مفيش طلبات لسة</p>
          ) : (
            <ul className="flex flex-col gap-[var(--mds-space-2)]">
              {profile.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="flex items-center justify-between rounded-[var(--mds-radius-md)] px-[var(--mds-space-4)] py-[var(--mds-space-2)] transition-colors hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-[var(--mds-space-2)]">
                      <Receipt className="size-4 text-muted-foreground" />
                      {o.order_number}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(o.total)}
                    </span>
                  </Link>
                  <p className="px-[var(--mds-space-4)] text-xs text-muted-foreground">
                    {formatDateTime(o.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </OperationalCard>
      </div>

      <OperationalCard
        title="سجل الولاء"
        description={`الرصيد الحالي ${profile.loyaltyBalance} نقطة`}
      >
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">مفيش حركات نقاط لسة</p>
        ) : (
          <ul className="divide-y divide-border">
            {ledger.map((e) => (
              <li
                key={e.id}
                className="flex justify-between gap-[var(--mds-space-3)] py-[var(--mds-space-2)]"
              >
                <span className="text-sm">{e.reason}</span>
                <span
                  className={
                    e.points_delta >= 0
                      ? "tabular-nums text-[var(--mds-color-feedback-success)]"
                      : "tabular-nums text-[var(--mds-color-feedback-danger)]"
                  }
                >
                  {e.points_delta >= 0 ? "+" : ""}
                  {e.points_delta} (رصيد {e.balance_after})
                </span>
              </li>
            ))}
          </ul>
        )}
      </OperationalCard>

      {profile.notes ? (
        <OperationalCard title="ملاحظات">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{profile.notes}</p>
        </OperationalCard>
      ) : null}
    </div>
  );
}
