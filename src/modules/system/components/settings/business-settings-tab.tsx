"use client";

import { useState, useTransition } from "react";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import {
  updateOrgSettingsAction,
  uploadOrganizationLogoAction,
} from "@/modules/system/actions/system.actions";
import { languageOptions } from "@/lib/i18n/translations";
import type { Organization } from "@/lib/types";
import { useUiStore } from "@/stores/ui-store";

interface BusinessSettingsTabProps {
  org: {
    organization: Organization;
    taxRate: number;
    taxInclusive: boolean;
  };
}

export function BusinessSettingsTab({ org }: BusinessSettingsTabProps) {
  const [pending, startTransition] = useTransition();
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const [logoUrl, setLogoUrl] = useState(org.organization.logo_url ?? "");
  const [form, setForm] = useState({
    name: org.organization.name,
    currency: org.organization.currency,
    timezone: org.organization.timezone,
    country: org.organization.country,
    phone: (org.organization.settings.phone as string | undefined) ?? "",
    address: (org.organization.settings.address as string | undefined) ?? "",
  });

  return (
    <div className="space-y-6">
      <OperationalCard title="Store profile">
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label>Store name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Logo</Label>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Store logo" className="mb-2 h-16 w-16 rounded-lg object-cover" />
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
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
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
                    phone: form.phone,
                    address: form.address,
                  });
                  toast.success("Store settings saved");
                } catch {
                  toast.error("Failed to save");
                }
              })
            }
          >
            Save store settings
          </Button>
        </div>
      </OperationalCard>
    </div>
  );
}
