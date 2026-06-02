"use client";

import { useState, useTransition } from "react";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import {
  updateOrgSettingsAction,
  updateOnlineMenuSettingsAction,
  uploadOrganizationLogoAction,
} from "@/modules/system/actions/system.actions";
import { languageOptions } from "@/lib/i18n/translations";
import type { OnlineMenuSettings, Organization } from "@/lib/types";
import { useUiStore } from "@/stores/ui-store";

interface BusinessSettingsTabProps {
  org: {
    organization: Organization;
    taxRate: number;
    taxInclusive: boolean;
  };
  onlineMenuSettings: OnlineMenuSettings;
}

export function BusinessSettingsTab({ org, onlineMenuSettings }: BusinessSettingsTabProps) {
  const [pending, startTransition] = useTransition();
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const [onlineMenuForm, setOnlineMenuForm] = useState(onlineMenuSettings);
  const [logoUrl, setLogoUrl] = useState(org.organization.logo_url ?? "");
  const [form, setForm] = useState({
    name: org.organization.name,
    currency: org.organization.currency,
    timezone: org.organization.timezone,
    country: org.organization.country,
  });

  return (
    <div className="space-y-6">
      <OperationalCard title="Organization">
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Logo</Label>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Organization logo" className="mb-2 h-16 w-16 rounded-lg object-cover" />
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                startTransition(async () => {
                  try {
                    const fd = new FormData();
                    fd.set("logo", file);
                    const url = await uploadOrganizationLogoAction(fd);
                    setLogoUrl(url);
                    toast.success("Logo uploaded");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Upload failed");
                  }
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2 border-t border-border/60 pt-4">
            <Label>App language</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Languages className="size-4 text-muted-foreground" />
              <div className="inline-flex rounded-md border border-border/70 bg-muted p-1">
                {languageOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={language === option.value ? "default" : "ghost"}
                    className="h-7 rounded-sm"
                    onClick={() => setLanguage(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await updateOrgSettingsAction({
                    name: form.name,
                    currency: form.currency,
                    timezone: form.timezone,
                    country: form.country,
                  });
                  toast.success("Organization saved");
                } catch {
                  toast.error("Failed to save");
                }
              })
            }
          >
            Save organization
          </Button>
        </div>
      </OperationalCard>

      <OperationalCard title="Online menu storefront">
        <div className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input
                value={onlineMenuForm.logoUrl}
                onChange={(e) =>
                  setOnlineMenuForm({ ...onlineMenuForm, logoUrl: e.target.value })
                }
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp number</Label>
              <Input
                value={onlineMenuForm.whatsappNumber}
                onChange={(e) =>
                  setOnlineMenuForm({ ...onlineMenuForm, whatsappNumber: e.target.value })
                }
                placeholder="201000000000"
              />
            </div>
            <div className="space-y-2">
              <Label>Hero title</Label>
              <Input
                value={onlineMenuForm.heroTitle}
                onChange={(e) =>
                  setOnlineMenuForm({ ...onlineMenuForm, heroTitle: e.target.value })
                }
                placeholder="Leave empty to use business name"
              />
            </div>
            <div className="space-y-2">
              <Label>Hero subtitle</Label>
              <Input
                value={onlineMenuForm.heroSubtitle}
                onChange={(e) =>
                  setOnlineMenuForm({ ...onlineMenuForm, heroSubtitle: e.target.value })
                }
                placeholder="Fresh picks, daily specials..."
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp message</Label>
              <Textarea
                value={onlineMenuForm.whatsappMessage}
                onChange={(e) =>
                  setOnlineMenuForm({ ...onlineMenuForm, whatsappMessage: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Footer text</Label>
              <Textarea
                value={onlineMenuForm.footerText}
                onChange={(e) =>
                  setOnlineMenuForm({ ...onlineMenuForm, footerText: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
            <div className="space-y-2">
              <Label>Primary color</Label>
              <Input
                value={onlineMenuForm.primaryColor}
                onChange={(e) =>
                  setOnlineMenuForm({ ...onlineMenuForm, primaryColor: e.target.value })
                }
                placeholder="#2563EB"
              />
            </div>
            <div className="space-y-2">
              <Label>Accent color</Label>
              <Input
                value={onlineMenuForm.accentColor}
                onChange={(e) =>
                  setOnlineMenuForm({ ...onlineMenuForm, accentColor: e.target.value })
                }
                placeholder="#16A34A"
              />
            </div>
            <div className="space-y-2">
              <Label>Product card style</Label>
              <select
                className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                value={onlineMenuForm.productCardStyle}
                onChange={(e) =>
                  setOnlineMenuForm({
                    ...onlineMenuForm,
                    productCardStyle: e.target.value === "compact" ? "compact" : "visual",
                  })
                }
              >
                <option value="visual">Visual</option>
                <option value="compact">Compact</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["showSearch", "Search"],
                ["showCategories", "Categories"],
                ["showCart", "Cart and orders"],
                ["showPrices", "Prices"],
                ["showImages", "Images"],
                ["showPopular", "Popular badges"],
                ["showVariants", "Variants"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-xl border border-border/60 p-3"
              >
                <Checkbox
                  checked={onlineMenuForm[key]}
                  onCheckedChange={(v) =>
                    setOnlineMenuForm({ ...onlineMenuForm, [key]: v === true })
                  }
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>

          <Button
            className="w-fit"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await updateOnlineMenuSettingsAction(onlineMenuForm);
                  toast.success("Online menu settings saved");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Failed to save online menu"
                  );
                }
              })
            }
          >
            Save online menu
          </Button>
        </div>
      </OperationalCard>
    </div>
  );
}
