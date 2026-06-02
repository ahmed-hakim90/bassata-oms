"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ACTIVITY_PRESETS,
  BUSINESS_ACTIVITY_TYPES,
  DEFAULT_BUSINESS_ACTIVITY_SETTINGS,
  PRODUCT_TEMPLATE_IDS,
  PRODUCT_TYPES,
  MEASUREMENT_UNITS,
  PRODUCT_SALES_UNIT_TYPES,
  INVENTORY_TRACKING_MODES,
  INVENTORY_ROTATION_METHODS,
  EXPIRY_POLICIES,
  SALES_MODES,
  type BusinessActivitySettings,
  type BusinessActivityType,
  type ProductTemplateSettings,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import {
  applyBusinessActivityPresetAction,
  updateBusinessActivitySettingsAction,
  updateProductTemplateSettingsAction,
} from "@/modules/system/actions/system.actions";

interface Props {
  initialSettings: BusinessActivitySettings;
  initialTemplates: ProductTemplateSettings;
}

export function BusinessActivitySettingsTab({ initialSettings, initialTemplates }: Props) {
  const [pending, startTransition] = useTransition();
  const initialModes =
    Array.isArray(initialSettings.enabled_sales_modes) &&
    initialSettings.enabled_sales_modes.length > 0
      ? initialSettings.enabled_sales_modes
      : DEFAULT_BUSINESS_ACTIVITY_SETTINGS.enabled_sales_modes;
  const initialDefaultMode = initialModes.includes(initialSettings.default_sales_mode)
    ? initialSettings.default_sales_mode
    : initialModes[0] ?? DEFAULT_BUSINESS_ACTIVITY_SETTINGS.default_sales_mode;
  const [form, setForm] = useState<BusinessActivitySettings>({
    ...DEFAULT_BUSINESS_ACTIVITY_SETTINGS,
    ...initialSettings,
    enabled_sales_modes: initialModes,
    default_sales_mode: initialDefaultMode,
  });
  const [templates, setTemplates] = useState<ProductTemplateSettings>(initialTemplates);

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
    <div className="space-y-6">
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

      <OperationalCard title="Product Templates">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure smart defaults used by the guided Product create/edit flow.
          </p>
          <div className="grid gap-4">
            {PRODUCT_TEMPLATE_IDS.map((templateId) => {
              const template = templates[templateId];
              return (
                <div key={templateId} className="rounded-xl border border-border/60 p-4">
                  <div className="mb-3 text-sm font-medium">{template.label}</div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Product type</Label>
                      <select
                        className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                        value={template.product_type}
                        onChange={(e) =>
                          setTemplates((prev) => ({
                            ...prev,
                            [templateId]: { ...prev[templateId], product_type: e.target.value as never },
                          }))
                        }
                      >
                        {PRODUCT_TYPES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Selling method</Label>
                      <select
                        className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                        value={template.sales_unit_type}
                        onChange={(e) =>
                          setTemplates((prev) => ({
                            ...prev,
                            [templateId]: {
                              ...prev[templateId],
                              sales_unit_type: e.target.value as never,
                            },
                          }))
                        }
                      >
                        {PRODUCT_SALES_UNIT_TYPES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Unit</Label>
                      <select
                        className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                        value={template.unit}
                        onChange={(e) =>
                          setTemplates((prev) => ({
                            ...prev,
                            [templateId]: { ...prev[templateId], unit: e.target.value as never },
                          }))
                        }
                      >
                        {MEASUREMENT_UNITS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Tracking mode</Label>
                      <select
                        className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                        value={template.inventory_tracking_mode}
                        onChange={(e) =>
                          setTemplates((prev) => ({
                            ...prev,
                            [templateId]: {
                              ...prev[templateId],
                              inventory_tracking_mode: e.target.value as never,
                            },
                          }))
                        }
                      >
                        {INVENTORY_TRACKING_MODES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Rotation</Label>
                      <select
                        className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                        value={template.inventory_rotation_method}
                        onChange={(e) =>
                          setTemplates((prev) => ({
                            ...prev,
                            [templateId]: {
                              ...prev[templateId],
                              inventory_rotation_method: e.target.value as never,
                            },
                          }))
                        }
                      >
                        {INVENTORY_ROTATION_METHODS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Expiry policy</Label>
                      <select
                        className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                        value={template.expiry_policy}
                        onChange={(e) =>
                          setTemplates((prev) => ({
                            ...prev,
                            [templateId]: { ...prev[templateId], expiry_policy: e.target.value as never },
                          }))
                        }
                      >
                        {EXPIRY_POLICIES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {(
                      [
                        ["expiry_tracking_enabled", "Track expiry"],
                        ["allow_fractional_quantity", "Fractional quantity"],
                        ["allow_price_input", "Allow price input"],
                        ["track_inventory", "Track inventory"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 rounded-xl border p-2">
                        <Checkbox
                          checked={template[key]}
                          onCheckedChange={(value) =>
                            setTemplates((prev) => ({
                              ...prev,
                              [templateId]: { ...prev[templateId], [key]: value === true },
                            }))
                          }
                        />
                        <span className="text-xs">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await updateProductTemplateSettingsAction(templates);
                  toast.success("Product templates saved");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to save templates");
                }
              })
            }
          >
            Save product templates
          </Button>
        </div>
      </OperationalCard>
    </div>
  );
}
