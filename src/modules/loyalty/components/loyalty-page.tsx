"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { formatRelativeTime } from "@/lib/format";
import { selectLabelById } from "@/lib/select-label";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { Customer, LoyaltyLedgerEntry, LoyaltyRule } from "@/lib/types";
import { redeemPointsAction } from "@/modules/loyalty/actions/loyalty.actions";
import { LoyaltyRulesForm } from "./loyalty-rules-form";

interface LoyaltyPageProps {
  rule: LoyaltyRule;
  stats: { activeCustomers: number; totalIssued: number; totalRedeemed: number };
  ledger: LoyaltyLedgerEntry[];
  customers: Customer[];
}

export function LoyaltyPage({ rule, stats, ledger, customers }: LoyaltyPageProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [redeem, setRedeem] = useState({ customerId: "", points: 0, reason: "" });

  const redeemSubmit = () => {
    startTransition(async () => {
      try {
        await redeemPointsAction(redeem);
        toast.success(t("Points redeemed"));
        setRedeem({ customerId: "", points: 0, reason: "" });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("Failed"));
      }
    });
  };

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]" dir="rtl">
      <PageHeader
        title={t("Loyalty")}
        description={t("Customers earn points on every sale and redeem them as a discount at the POS")}
      />

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-3">
        <KpiCard
          label={t("Active Members")}
          value={String(stats.activeCustomers)}
          icon={<Heart className="size-5" />}
        />
        <KpiCard label={t("Points Issued")} value={String(stats.totalIssued)} />
        <KpiCard label={t("Points Redeemed")} value={String(stats.totalRedeemed)} />
      </div>

      <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-2">
        <LoyaltyRulesForm rule={rule} />

        <OperationalCard
          title={t("Redeem Points")}
          description={t("Manual redemption — at the POS the cashier can redeem directly during payment")}
        >
          <div className="grid gap-[var(--mds-space-4)]">
            <div className="space-y-[var(--mds-space-2)]">
              <Label>{t("Customer")}</Label>
              <Select
                value={redeem.customerId}
                onValueChange={(v) =>
                  setRedeem({ ...redeem, customerId: v ?? "" })
                }
              >
                <SelectTrigger className="w-full rounded-[var(--mds-radius-md)]">
                  <SelectValue placeholder={t("Select customer")}>
                    {(value) => selectLabelById(customers, value, (c) => c.name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id} label={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="loyalty-points">{t("Points")}</Label>
              <Input
                id="loyalty-points"
                type="number"
                min={1}
                value={redeem.points || ""}
                onChange={(e) =>
                  setRedeem({
                    ...redeem,
                    points: parseInt(e.target.value) || 0,
                  })
                }
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="loyalty-reason">{t("Reason")}</Label>
              <Input
                id="loyalty-reason"
                value={redeem.reason}
                onChange={(e) =>
                  setRedeem({ ...redeem, reason: e.target.value })
                }
                placeholder={t("Manual redemption")}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <Button
              onClick={redeemSubmit}
              disabled={pending}
              className="shadow-[var(--mds-elevation-1)]"
            >
              {t("Redeem")}
            </Button>
          </div>
        </OperationalCard>
      </div>

      <OperationalCard title={t("Recent Activity")}>
        {ledger.length === 0 ? (
          <p className="py-[var(--mds-space-6)] text-center text-sm text-muted-foreground">
            {t("No loyalty activity yet. Attach a customer to a sale and points are earned automatically")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {ledger.map((e) => (
              <li
                key={e.id}
                className="flex justify-between gap-[var(--mds-space-3)] py-[var(--mds-space-2)]"
              >
                <span className="text-sm">
                  {customers.find((c) => c.id === e.customer_id)?.name ?? e.customer_id}{" "}
                  · {e.reason === "Purchase" ? t("Purchase") : e.reason}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums" dir="ltr">
                  {e.points_delta >= 0 ? "+" : ""}
                  {e.points_delta} · {formatRelativeTime(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </OperationalCard>
    </div>
  );
}
