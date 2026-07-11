"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { LoyaltyRule } from "@/lib/types";
import { updateLoyaltyRuleAction } from "@/modules/loyalty/actions/loyalty.actions";

interface LoyaltyRulesFormProps {
  rule: LoyaltyRule;
}

export function LoyaltyRulesForm({ rule: initial }: LoyaltyRulesFormProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [rule, setRule] = useState(initial);

  const save = () => {
    startTransition(async () => {
      try {
        await updateLoyaltyRuleAction({
          pointsPerCurrency: rule.points_per_currency,
          redemptionRate: rule.redemption_rate,
          minimumRedeemPoints: rule.minimum_redeem_points,
          isActive: rule.is_active,
        });
        toast.success(t("Rules updated"));
      } catch {
        toast.error(t("Failed to update"));
      }
    });
  };

  return (
    <OperationalCard title={t("Earn & Redeem Rules")}>
      <div className="grid max-w-md gap-[var(--mds-space-4)]">
        <div className="space-y-[var(--mds-space-2)]">
          <Label htmlFor="points-per-currency">{t("Points earned per 1 currency spent")}</Label>
          <Input
            id="points-per-currency"
            type="number"
            min={0}
            step={0.1}
            value={rule.points_per_currency}
            onChange={(e) =>
              setRule({
                ...rule,
                points_per_currency: parseFloat(e.target.value) || 0,
              })
            }
            className="rounded-[var(--mds-radius-md)]"
          />
          <p className="text-xs text-muted-foreground">
            {t("Example")}: {t("a customer paying")} {formatCurrency(100)}{" "}
            {t("earns")} {Math.floor(100 * rule.points_per_currency)} {t("points")}
          </p>
        </div>
        <div className="space-y-[var(--mds-space-2)]">
          <Label htmlFor="redemption-rate">{t("Value of 1 point when redeemed")}</Label>
          <Input
            id="redemption-rate"
            type="number"
            min={0}
            step={0.001}
            value={rule.redemption_rate}
            onChange={(e) =>
              setRule({
                ...rule,
                redemption_rate: parseFloat(e.target.value) || 0,
              })
            }
            className="rounded-[var(--mds-radius-md)]"
          />
          <p className="text-xs text-muted-foreground">
            {t("Example")}: 100 {t("points")} ={" "}
            {formatCurrency(Math.round(100 * rule.redemption_rate * 100) / 100)}{" "}
            {t("discount at checkout")}
          </p>
        </div>
        <div className="space-y-[var(--mds-space-2)]">
          <Label htmlFor="min-redeem">{t("Minimum points to redeem")}</Label>
          <Input
            id="min-redeem"
            type="number"
            min={0}
            step={1}
            value={rule.minimum_redeem_points}
            onChange={(e) =>
              setRule({
                ...rule,
                minimum_redeem_points: Math.max(0, parseInt(e.target.value) || 0),
              })
            }
            className="rounded-[var(--mds-radius-md)]"
          />
          <p className="text-xs text-muted-foreground">
            {t("Customers must have at least this many points before redeeming at POS")}
          </p>
        </div>
        <label className="flex items-center gap-[var(--mds-space-2)]">
          <Checkbox
            checked={rule.is_active}
            onCheckedChange={(v) =>
              setRule({ ...rule, is_active: v === true })
            }
          />
          <span className="text-sm">{t("Program active")}</span>
        </label>
        <Button
          onClick={save}
          disabled={pending}
          className="shadow-[var(--mds-elevation-1)]"
        >
          {t("Save Rules")}
        </Button>
      </div>
    </OperationalCard>
  );
}
