"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import type { LoyaltyRule } from "@/lib/types";
import { updateLoyaltyRuleAction } from "@/modules/loyalty/actions/loyalty.actions";

interface LoyaltyRulesFormProps {
  rule: LoyaltyRule;
}

export function LoyaltyRulesForm({ rule: initial }: LoyaltyRulesFormProps) {
  const [pending, startTransition] = useTransition();
  const [rule, setRule] = useState(initial);

  const save = () => {
    startTransition(async () => {
      try {
        await updateLoyaltyRuleAction({
          pointsPerCurrency: rule.points_per_currency,
          redemptionRate: rule.redemption_rate,
          isActive: rule.is_active,
        });
        toast.success("Rules updated");
      } catch {
        toast.error("Failed to update");
      }
    });
  };

  return (
    <OperationalCard title="Earn & Redeem Rules">
      <div className="grid max-w-md gap-4">
        <div className="space-y-2">
          <Label>Points per $1 spent</Label>
          <Input
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
          />
        </div>
        <div className="space-y-2">
          <Label>Redemption rate ($ per point)</Label>
          <Input
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
          />
        </div>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={rule.is_active}
            onCheckedChange={(v) =>
              setRule({ ...rule, is_active: v === true })
            }
          />
          <span className="text-sm">Program active</span>
        </label>
        <Button onClick={save} disabled={pending}>
          Save Rules
        </Button>
      </div>
    </OperationalCard>
  );
}
