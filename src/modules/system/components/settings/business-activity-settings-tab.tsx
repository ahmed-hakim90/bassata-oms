"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ACTIVITY_PRESETS,
  BUSINESS_ACTIVITY_TYPES,
  SALES_MODES,
  type BusinessActivitySettings,
  type BusinessActivityType,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import {
  applyBusinessActivityPresetAction,
  updateBusinessActivitySettingsAction,
} from "@/modules/system/actions/system.actions";

interface Props {
  initialSettings: BusinessActivitySettings;
}

export function BusinessActivitySettingsTab({ initialSettings }: Props) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<BusinessActivitySettings>(initialSettings);

  function toggleSalesMode(mode: "retail" | "wholesale") {
    const has = form.enabled_sales_modes.includes(mode);
    const enabled_sales_modes = has
      ? form.enabled_sales_modes.filter((m) => m !== mode)
      : [...form.enabled_sales_modes, mode];
    setForm((prev) => ({
      ...prev,
      enabled_sales_modes,
      default_sales_mode: enabled_sales_modes.includes(prev.default_sales_mode)
        ? prev.default_sales_mode
        : "retail",
    }));
  }

  function applyPreset(activity: BusinessActivityType) {
    const preset = ACTIVITY_PRESETS[activity];
    const next = { ...form, ...preset, activity_type: activity };
    delete (next as { featureFlags?: unknown }).featureFlags;
    setForm(next as BusinessActivitySettings);
    startTransition(async () => {
      try {
        await applyBusinessActivityPresetAction(activity);
        toast.success("Business activity preset applied");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to apply preset");
      }
    });
  }

  return (
    <OperationalCard title="Business Activity">
      <div className="grid max-w-2xl gap-5">
        <div className="space-y-2">
          <Label>Activity type</Label>
          <select
            className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            value={form.activity_type}
            onChange={(e) => applyPreset(e.target.value as BusinessActivityType)}
          >
            {BUSINESS_ACTIVITY_TYPES.map((activity) => (
              <option key={activity} value={activity}>
                {activity}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Enabled sales modes</Label>
          <div className="grid grid-cols-2 gap-2">
            {SALES_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-2 rounded-xl border p-3">
                <Checkbox
                  checked={form.enabled_sales_modes.includes(mode)}
                  onCheckedChange={() => toggleSalesMode(mode)}
                />
                <span className="text-sm capitalize">{mode}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["enable_weight_sales", "Enable weight sales"],
              ["enable_piece_sales", "Enable piece sales"],
              ["enable_wholesale_sales", "Enable wholesale sales"],
              ["enable_variants", "Enable variants"],
              ["enable_price_by_amount", "Enable price by amount"],
              ["allow_cashier_wholesale", "Allow cashier wholesale"],
              ["require_manager_for_wholesale", "Require manager for wholesale"],
              ["auto_apply_wholesale_by_quantity", "Auto-apply wholesale by quantity"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-xl border p-3">
              <Checkbox
                checked={form[key]}
                onCheckedChange={(value) => setForm((prev) => ({ ...prev, [key]: value === true }))}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Default sales mode</Label>
          <select
            className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            value={form.default_sales_mode}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                default_sales_mode: e.target.value as BusinessActivitySettings["default_sales_mode"],
              }))
            }
          >
            {form.enabled_sales_modes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </div>

        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await updateBusinessActivitySettingsAction(form);
                toast.success("Business activity settings saved");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to save settings");
              }
            })
          }
        >
          Save business activity
        </Button>
      </div>
    </OperationalCard>
  );
}
