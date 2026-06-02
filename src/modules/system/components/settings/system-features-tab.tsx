"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { updateFeatureFlagsAction } from "@/modules/system/actions/system.actions";
import { ADVANCED_FEATURE_FLAGS, type FeatureFlag } from "@/lib/constants";

interface SystemFeaturesTabProps {
  featureFlags: Record<FeatureFlag, boolean>;
}

export function SystemFeaturesTab({ featureFlags }: SystemFeaturesTabProps) {
  const [pending, startTransition] = useTransition();
  const [flags, setFlags] = useState<Partial<Record<FeatureFlag, boolean>>>(() =>
    Object.fromEntries(
      ADVANCED_FEATURE_FLAGS.map((flag) => [flag, featureFlags[flag]])
    )
  );

  return (
    <OperationalCard title="System features">
      <p className="mb-4 text-sm text-muted-foreground">
        Advanced module toggles. Daily POS options (payments, receipt, tax) are under POS &
        Sessions.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ADVANCED_FEATURE_FLAGS.map((flag) => (
          <label
            key={flag}
            className="flex items-center gap-2 rounded-xl border border-border/60 p-3"
          >
            <Checkbox
              checked={flags[flag]}
              onCheckedChange={(v) =>
                setFlags({ ...flags, [flag]: v === true })
              }
            />
            <span className="text-sm">{flag.replaceAll("_", " ")}</span>
          </label>
        ))}
      </div>
      <Button
        disabled={pending}
        className="mt-4"
        onClick={() =>
          startTransition(async () => {
            try {
              const patch = Object.fromEntries(
                ADVANCED_FEATURE_FLAGS.map((flag) => [flag, flags[flag]])
              ) as Partial<Record<FeatureFlag, boolean>>;
              await updateFeatureFlagsAction(patch);
              toast.success("Feature flags saved");
            } catch {
              toast.error("Failed to save");
            }
          })
        }
      >
        Save system features
      </Button>
    </OperationalCard>
  );
}
