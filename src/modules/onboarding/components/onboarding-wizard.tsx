"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { APP_NAME, BUSINESS_ACTIVITY_TYPES, type BusinessActivityType } from "@/lib/constants";
import { completeOnboardingAction } from "@/modules/onboarding/actions/onboarding.actions";
import {
  type OnboardingPayload,
  ONBOARDING_FEATURE_KEYS,
  type OnboardingFeatureKey,
} from "@/modules/onboarding/schemas/onboarding.schema";

const STEPS = [
  "Company",
  "First Branch",
  "Owner Account",
  "Business Type",
  "Features",
  "Default Settings",
  "Initial Setup",
] as const;

const FEATURE_LABELS: Record<OnboardingFeatureKey, string> = {
  recipes: "Recipes & costing",
  variants: "Variants",
  weight_sales: "Weight sales",
  wholesale_sales: "Wholesale sales",
  purchases: "Purchases",
  transfers: "Transfers",
  waste: "Waste tracking",
  stock_count: "Stock count",
  loyalty: "Loyalty program",
  customer_accounts: "Customer accounts",
  credit_sales: "Credit sales",
  monthly_closing: "Monthly closing",
  imports_exports: "Imports/exports",
  barcode_scanner: "Barcode scanner",
};

const DEFAULT_FEATURES = Object.fromEntries(
  ONBOARDING_FEATURE_KEYS.map((key) => [key, key !== "credit_sales" && key !== "wholesale_sales"])
) as Record<OnboardingFeatureKey, boolean>;
const BUSINESS_TYPE_LABELS: Record<BusinessActivityType, string> = {
  cafe: "Cafe",
  ice_cream: "Ice cream",
  restaurant: "Restaurant",
  bakery: "Bakery / patisserie",
  juice_bar: "Juice bar",
  supermarket: "Supermarket",
  dairy_meat: "Dairy / meat / fresh food",
  apparel: "Apparel / fashion",
  electronics: "Electronics",
  cosmetics: "Cosmetics",
  bookstore: "Bookstore / stationery",
  retail: "General retail",
  wholesale: "Wholesale",
  mixed: "Mixed activity",
};

export function OnboardingWizard({
  inviteToken,
  inviteOrgName,
  inviteOwnerName,
  inviteOwnerEmail,
}: {
  inviteToken: string;
  inviteOrgName?: string;
  inviteOwnerName?: string;
  inviteOwnerEmail?: string;
}) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  const [organization, setOrganization] = useState({
    name: inviteOrgName ?? "",
    logoUrl: "",
    currency: "USD",
    timezone: "America/New_York",
    country: "",
    taxEnabled: true,
    taxRate: 0,
    taxInclusive: true,
  });
  const [store, setStore] = useState({
    name: "",
    address: "",
    phone: "",
    timezone: "America/New_York",
  });
  const [owner, setOwner] = useState({
    name: inviteOwnerName ?? "",
    email: inviteOwnerEmail ?? "",
    password: "",
  });
  const [businessType, setBusinessType] = useState<BusinessActivityType>("retail");
  const [features, setFeatures] =
    useState<Record<OnboardingFeatureKey, boolean>>(DEFAULT_FEATURES);
  const [defaultSettings, setDefaultSettings] = useState({
    paymentMethods: {
      cash: true,
      card: true,
      wallet: true,
      credit: false,
      manualWallet: true,
    },
    receiptHeader: "",
    receiptFooter: "",
    preventNegativeStock: true,
    defaultTaxBehavior: "inclusive" as "inclusive" | "exclusive",
    sessionRules: {
      maxOpenHours: 24,
      warnAfterHours: 20,
      blockSalesWhenExpired: true,
      requireManagerOverrideForExpiredSale: true,
      allowManagerForceClose: true,
    },
    expenseRules: {
      approvalRequired: false,
      cashierCanAddSessionExpense: true,
      allowInventoryPurchaseFromSession: true,
      preventExpensesInClosedPeriods: true,
    },
  });
  const [initialSetup, setInitialSetup] = useState({
    createDefaultCostCenters: true,
    createDefaultExpenseCategories: true,
    createDefaultProductCategories: true,
    createDefaultInventoryUnits: true,
    createFirstPosDevice: false,
    firstPosDeviceName: "POS-1",
  });

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
        if (organization.taxRate < 0 || organization.taxRate > 100)
          return "Tax rate must be between 0 and 100.";
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
      case 5:
        if (
          defaultSettings.sessionRules.warnAfterHours >
          defaultSettings.sessionRules.maxOpenHours
        ) {
          return "Session warning hours cannot exceed max open hours.";
        }
        return null;
      case 6:
        if (initialSetup.createFirstPosDevice && !initialSetup.firstPosDeviceName.trim()) {
          return "POS device name is required when device creation is enabled.";
        }
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
    setStep(Math.min(step + 1, STEPS.length - 1));
  }

  function submit() {
    const payload: OnboardingPayload = {
      organization,
      store,
      owner,
      businessType,
      defaultSettings,
      features,
      initialSetup,
    };

    startTransition(async () => {
      const result = await completeOnboardingAction(payload, inviteToken);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to {APP_NAME}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set up your company in seven steps
        </p>
      </div>

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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax rate (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={organization.taxRate}
                  onChange={(e) =>
                    setOrganization({ ...organization, taxRate: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tax behavior</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={organization.taxInclusive}
                    onCheckedChange={(checked) =>
                      setOrganization({ ...organization, taxInclusive: checked === true })
                    }
                  />
                  Tax inclusive
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={organization.taxEnabled}
                    onCheckedChange={(checked) =>
                      setOrganization({ ...organization, taxEnabled: checked === true })
                    }
                  />
                  Tax enabled
                </label>
              </div>
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
            <div className="space-y-2">
              <Label>Store timezone</Label>
              <Input
                value={store.timezone}
                onChange={(e) => setStore({ ...store, timezone: e.target.value })}
              />
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
                readOnly={Boolean(inviteOwnerEmail)}
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
        <OperationalCard title="Business type">
          <div className="grid gap-3 sm:grid-cols-2">
            {BUSINESS_ACTIVITY_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <Checkbox
                  checked={businessType === type}
                  onCheckedChange={(checked) => {
                    if (checked === true) setBusinessType(type);
                  }}
                />
                {BUSINESS_TYPE_LABELS[type]}
              </label>
            ))}
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
        <OperationalCard title="Default settings">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Receipt header</Label>
              <Textarea
                value={defaultSettings.receiptHeader}
                onChange={(e) =>
                  setDefaultSettings({ ...defaultSettings, receiptHeader: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Receipt footer</Label>
              <Textarea
                value={defaultSettings.receiptFooter}
                onChange={(e) =>
                  setDefaultSettings({ ...defaultSettings, receiptFooter: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(defaultSettings.paymentMethods).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={value}
                    onCheckedChange={(checked) =>
                      setDefaultSettings({
                        ...defaultSettings,
                        paymentMethods: {
                          ...defaultSettings.paymentMethods,
                          [key]: checked === true,
                        },
                      })
                    }
                  />
                  Payment {key}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={defaultSettings.preventNegativeStock}
                onCheckedChange={(checked) =>
                  setDefaultSettings({
                    ...defaultSettings,
                    preventNegativeStock: checked === true,
                  })
                }
              />
              Prevent negative stock
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={defaultSettings.defaultTaxBehavior === "inclusive"}
                onCheckedChange={(checked) =>
                  setDefaultSettings({
                    ...defaultSettings,
                    defaultTaxBehavior: checked === true ? "inclusive" : "exclusive",
                  })
                }
              />
              Default tax behavior: inclusive
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Session max open hours</Label>
                <Input
                  type="number"
                  min={1}
                  max={72}
                  value={defaultSettings.sessionRules.maxOpenHours}
                  onChange={(e) =>
                    setDefaultSettings({
                      ...defaultSettings,
                      sessionRules: {
                        ...defaultSettings.sessionRules,
                        maxOpenHours: Number(e.target.value) || 1,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Session warning hours</Label>
                <Input
                  type="number"
                  min={1}
                  max={72}
                  value={defaultSettings.sessionRules.warnAfterHours}
                  onChange={(e) =>
                    setDefaultSettings({
                      ...defaultSettings,
                      sessionRules: {
                        ...defaultSettings.sessionRules,
                        warnAfterHours: Number(e.target.value) || 1,
                      },
                    })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={defaultSettings.expenseRules.approvalRequired}
                onCheckedChange={(checked) =>
                  setDefaultSettings({
                    ...defaultSettings,
                    expenseRules: {
                      ...defaultSettings.expenseRules,
                      approvalRequired: checked === true,
                    },
                  })
                }
              />
              Expense approval required
            </label>
          </div>
        </OperationalCard>
      )}

      {step === 6 && (
        <OperationalCard title="Initial setup">
          <div className="grid gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={initialSetup.createDefaultCostCenters}
                onCheckedChange={(checked) =>
                  setInitialSetup({ ...initialSetup, createDefaultCostCenters: checked === true })
                }
              />
              Create default cost centers
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={initialSetup.createDefaultExpenseCategories}
                onCheckedChange={(checked) =>
                  setInitialSetup({
                    ...initialSetup,
                    createDefaultExpenseCategories: checked === true,
                  })
                }
              />
              Create default expense categories
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={initialSetup.createDefaultProductCategories}
                onCheckedChange={(checked) =>
                  setInitialSetup({
                    ...initialSetup,
                    createDefaultProductCategories: checked === true,
                  })
                }
              />
              Create default product categories
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={initialSetup.createDefaultInventoryUnits}
                onCheckedChange={(checked) =>
                  setInitialSetup({
                    ...initialSetup,
                    createDefaultInventoryUnits: checked === true,
                  })
                }
              />
              Create default inventory units
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={initialSetup.createFirstPosDevice}
                onCheckedChange={(checked) =>
                  setInitialSetup({ ...initialSetup, createFirstPosDevice: checked === true })
                }
              />
              Create first POS device placeholder
            </label>
            {initialSetup.createFirstPosDevice && (
              <div className="space-y-2">
                <Label>POS device name</Label>
                <Input
                  value={initialSetup.firstPosDeviceName}
                  onChange={(e) =>
                    setInitialSetup({ ...initialSetup, firstPosDeviceName: e.target.value })
                  }
                />
              </div>
            )}
          </div>
        </OperationalCard>
      )}

      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" disabled={step === 0 || pending} onClick={() => setStep(Math.max(step - 1, 0))}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={nextStep} disabled={pending}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Setting up..." : "Complete setup"}
          </Button>
        )}
      </div>
    </div>
  );
}
