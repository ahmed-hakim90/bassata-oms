"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { APP_NAME } from "@/lib/constants";
import { completeOnboardingAction } from "@/modules/onboarding/actions/onboarding.actions";
import {
  ONBOARDING_FEATURE_KEYS,
  type OnboardingFeatureKey,
  type OnboardingPayload,
} from "@/modules/onboarding/schemas/onboarding.schema";

const STEPS = [
  "Organization",
  "First Store",
  "Owner Account",
  "Business Settings",
  "Features",
  "Finish",
] as const;

const FEATURE_LABELS: Record<OnboardingFeatureKey, string> = {
  recipes: "Recipes & costing",
  loyalty: "Loyalty program",
  credit_sales: "Credit sales",
  waste: "Waste tracking",
  transfers: "Stock transfers",
  stock_count: "Stock count",
  barcode_scanner: "Barcode scanner",
  online_menu: "QR menu",
  online_orders: "Online orders",
};

const DEFAULT_FEATURES = Object.fromEntries(
  ONBOARDING_FEATURE_KEYS.map((key) => [
    key,
    key !== "recipes" && key !== "credit_sales",
  ])
) as Record<OnboardingFeatureKey, boolean>;

interface OnboardingWizardProps {
  hasOrganization: boolean;
  isBootstrapAdmin: boolean;
}

export function OnboardingWizard({
  hasOrganization,
  isBootstrapAdmin,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  const [organization, setOrganization] = useState({
    name: "",
    logoUrl: "",
    currency: "USD",
    timezone: "America/New_York",
    country: "",
  });
  const [store, setStore] = useState({ name: "", address: "", phone: "" });
  const [owner, setOwner] = useState({ name: "", email: "", password: "" });
  const [business, setBusiness] = useState({
    taxEnabled: true,
    taxRate: 0,
    receiptHeader: "",
    receiptFooter: "",
  });
  const [features, setFeatures] =
    useState<Record<OnboardingFeatureKey, boolean>>(DEFAULT_FEATURES);

  function handleLogoChange(file: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be 5 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setOrganization((prev) => ({ ...prev, logoUrl: String(reader.result ?? "") }));
    };
    reader.readAsDataURL(file);
  }

  function validateStep(): string | null {
    switch (step) {
      case 0:
        if (organization.name.trim().length < 2) return "Organization name is required.";
        if (!organization.country.trim()) return "Country is required.";
        return null;
      case 1:
        if (store.name.trim().length < 2) return "Store name is required.";
        if (!store.address.trim()) return "Store address is required.";
        return null;
      case 2:
        if (owner.name.trim().length < 2) return "Owner name is required.";
        if (!owner.email.includes("@")) return "Valid owner email is required.";
        if (owner.password.length < 8) return "Password must be at least 8 characters.";
        return null;
      default:
        return null;
    }
  }

  function nextStep() {
    const error = validateStep();
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function submit() {
    const payload: OnboardingPayload = {
      organization,
      store,
      owner,
      business,
      features,
    };

    startTransition(async () => {
      const result = await completeOnboardingAction(payload);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to {APP_NAME}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set up your organization in a few steps
        </p>
      </div>

      {hasOrganization && isBootstrapAdmin && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Bootstrap admin view: an organization already exists. Completing onboarding will
          fail to prevent duplicate tenants.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              index === step
                ? "bg-primary text-primary-foreground"
                : index < step
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {step === 0 && (
        <OperationalCard title="Organization info">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Organization name</Label>
              <Input
                value={organization.name}
                onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <Input type="file" accept="image/*" onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)} />
              {organization.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={organization.logoUrl} alt="Logo preview" className="mt-2 h-16 w-16 rounded-lg object-cover" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={organization.currency}
                  onChange={(e) => setOrganization({ ...organization, currency: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={organization.timezone}
                  onChange={(e) => setOrganization({ ...organization, timezone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={organization.country}
                onChange={(e) => setOrganization({ ...organization, country: e.target.value })}
              />
            </div>
          </div>
        </OperationalCard>
      )}

      {step === 1 && (
        <OperationalCard title="First store">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Store name</Label>
              <Input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} />
            </div>
          </div>
        </OperationalCard>
      )}

      {step === 2 && (
        <OperationalCard title="Owner account">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={owner.email}
                onChange={(e) => setOwner({ ...owner, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={owner.password}
                onChange={(e) => setOwner({ ...owner, password: e.target.value })}
              />
            </div>
          </div>
        </OperationalCard>
      )}

      {step === 3 && (
        <OperationalCard title="Business settings">
          <div className="grid gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={business.taxEnabled}
                onCheckedChange={(checked) =>
                  setBusiness({ ...business, taxEnabled: checked === true })
                }
              />
              Tax enabled
            </label>
            <div className="space-y-2">
              <Label>Tax percentage</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={business.taxRate}
                onChange={(e) =>
                  setBusiness({ ...business, taxRate: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Receipt header</Label>
              <Textarea
                value={business.receiptHeader}
                onChange={(e) => setBusiness({ ...business, receiptHeader: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Receipt footer</Label>
              <Textarea
                value={business.receiptFooter}
                onChange={(e) => setBusiness({ ...business, receiptFooter: e.target.value })}
              />
            </div>
          </div>
        </OperationalCard>
      )}

      {step === 4 && (
        <OperationalCard title="Features">
          <div className="grid gap-3 sm:grid-cols-2">
            {ONBOARDING_FEATURE_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={features[key]}
                  onCheckedChange={(checked) =>
                    setFeatures({ ...features, [key]: checked === true })
                  }
                />
                {FEATURE_LABELS[key]}
              </label>
            ))}
          </div>
        </OperationalCard>
      )}

      {step === 5 && (
        <OperationalCard title="Review & finish">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Organization</dt>
              <dd className="font-medium">{organization.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Store</dt>
              <dd className="font-medium">{store.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="font-medium">
                {owner.name} ({owner.email})
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="font-medium">
                {business.taxEnabled ? `${business.taxRate}%` : "Disabled"}
              </dd>
            </div>
          </dl>
        </OperationalCard>
      )}

      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" disabled={step === 0 || pending} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={nextStep} disabled={pending}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Setting up…" : "Complete setup"}
          </Button>
        )}
      </div>
    </div>
  );
}
