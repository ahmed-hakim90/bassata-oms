"use client";

import { useState, useTransition, Fragment } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import {
  APP_NAME,
  BUSINESS_ACTIVITY_TYPES,
  BUSINESS_ACTIVITY_TYPE_LABELS,
  type BusinessActivityType,
} from "@/lib/constants";
import { completeOnboardingAction } from "@/modules/onboarding/actions/onboarding.actions";
import {
  type OnboardingPayload,
  ONBOARDING_FEATURE_KEYS,
  type OnboardingFeatureKey,
  defaultOnboardingFeaturesForActivity,
} from "@/modules/onboarding/schemas/onboarding.schema";

const STEPS = [
  "الشركة",
  "أول فرع",
  "حساب المالك",
  "نوع النشاط",
  "الخصائص",
  "الإعدادات الافتراضية",
  "التجهيز الأولي",
] as const;

const FEATURE_LABELS: Record<OnboardingFeatureKey, string> = {
  recipes: "الوصفات",
  variants: "الخيارات / المتغيرات",
  purchases: "المشتريات",
  transfers: "التحويلات",
  waste: "الهالك",
  stock_count: "جرد المخزون",
  loyalty: "برنامج الولاء",
  customer_accounts: "خصومات العملاء",
  credit_sales: "البيع الآجل",
  imports_exports: "الاستيراد والتصدير",
  barcode_scanner: "قارئ الباركود",
};

const PAYMENT_METHOD_LABELS: Record<
  "cash" | "card" | "wallet" | "manualWallet",
  string
> = {
  cash: "الدفع النقدي",
  card: "الدفع بالكارت",
  wallet: "الدفع بالمحفظة",
  manualWallet: "طرق دفع أخرى",
};

export function OnboardingWizard({
  initialInviteToken = "",
}: {
  initialInviteToken?: string;
}) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [inviteToken, setInviteToken] = useState(initialInviteToken);

  const [organization, setOrganization] = useState({
    name: "",
    logoUrl: "",
    currency: "EGP",
    timezone: "Africa/Cairo",
    country: "EG",
    taxEnabled: true,
    taxRate: 0,
    taxInclusive: true,
  });
  const [store, setStore] = useState({
    name: "",
    address: "",
    phone: "",
    timezone: "Africa/Cairo",
  });
  const [owner, setOwner] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [businessType, setBusinessType] = useState<BusinessActivityType>("cafe");
  const [features, setFeatures] = useState<Record<OnboardingFeatureKey, boolean>>(
    () => defaultOnboardingFeaturesForActivity("cafe")
  );
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
    preventNegativeStock: false,
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
      toast.error("يجب أن يكون الشعار 5 ميجابايت أو أقل.");
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
        if (organization.name.trim().length < 2) return "اسم المؤسسة مطلوب.";
        if (!organization.country.trim()) return "الدولة مطلوبة.";
        if (organization.taxRate < 0 || organization.taxRate > 100)
          return "نسبة الضريبة يجب أن تكون بين 0 و100.";
        return null;
      case 1:
        if (store.name.trim().length < 2) return "اسم الفرع مطلوب.";
        if (!store.address.trim()) return "عنوان الفرع مطلوب.";
        return null;
      case 2:
        if (owner.name.trim().length < 2) return "اسم المالك مطلوب.";
        if (!owner.email.includes("@")) return "بريد المالك الصحيح مطلوب.";
        if (owner.password.length < 8) return "كلمة المرور يجب ألا تقل عن 8 أحرف.";
        return null;
      case 5:
        if (
          defaultSettings.sessionRules.warnAfterHours >
          defaultSettings.sessionRules.maxOpenHours
        ) {
          return "ساعات تحذير الجلسة لا يمكن أن تتجاوز أقصى ساعات الفتح.";
        }
        return null;
      case 6:
        if (initialSetup.createFirstPosDevice && !initialSetup.firstPosDeviceName.trim()) {
          return "اسم جهاز الكاشير مطلوب عند تفعيل إنشاء الجهاز.";
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
      inviteToken: inviteToken.trim() || undefined,
      organization,
      store,
      owner,
      businessType,
      defaultSettings: {
        ...defaultSettings,
        paymentMethods: {
          ...defaultSettings.paymentMethods,
          credit: features.credit_sales,
        },
        defaultTaxBehavior: organization.taxInclusive ? "inclusive" : "exclusive",
      },
      features,
      initialSetup,
    };

    startTransition(async () => {
      const result = await completeOnboardingAction(payload);
      if (result?.error) toast.error(result.error);
    });
  }

  const progressPct = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div className="space-y-[var(--mds-space-6)]">
      {/* Harbor header card with primary accent stripe */}
      <div className="rounded-[var(--mds-radius-xl)] border border-border shadow-[var(--mds-elevation-2)] bg-card overflow-hidden">
        <div className="h-1 bg-[var(--mds-color-action-primary)]" />
        <div className="px-[var(--mds-space-6)] py-[var(--mds-space-5)] text-center">
          <h1 className="text-2xl font-semibold tracking-tight">مرحبًا بك في {APP_NAME}</h1>
          <p className="mt-[var(--mds-space-2)] text-sm text-muted-foreground">
            جهّز شركتك في سبع خطوات
          </p>
        </div>
      </div>

      {/* Step indicator card */}
      <div className="rounded-[var(--mds-radius-xl)] border border-border shadow-[var(--mds-elevation-2)] bg-card overflow-hidden">
        {/* Progress stripe */}
        <div className="h-1 bg-muted relative overflow-hidden">
          <div
            className="absolute inset-y-0 start-0 bg-[var(--mds-color-action-primary)] transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="px-[var(--mds-space-4)] py-[var(--mds-space-4)]">
          {/* Numbered step circles + connectors */}
          <div className="flex items-center">
            {STEPS.map((label, index) => {
              const isActive = index === step;
              const isDone = index < step;
              return (
                <Fragment key={label}>
                  <div className="flex flex-col items-center gap-[var(--mds-space-1)] min-w-0">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                        isActive &&
                          "bg-[var(--mds-color-action-primary)] text-white shadow-md ring-2 ring-[var(--mds-color-action-primary)]/25 ring-offset-2",
                        isDone &&
                          "bg-[var(--mds-color-feedback-success)] text-white",
                        !isActive && !isDone && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </div>
                    <span
                      className={cn(
                        "hidden text-[10px] font-medium sm:block truncate max-w-[52px] text-center leading-tight",
                        isActive && "text-[var(--mds-color-action-primary)]",
                        isDone && "text-[var(--mds-color-feedback-success)]",
                        !isActive && !isDone && "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-px flex-1 mx-[var(--mds-space-1)] transition-colors duration-300",
                        isDone
                          ? "bg-[var(--mds-color-feedback-success)]"
                          : "bg-border"
                      )}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>

          {/* Mobile: current step label */}
          <p className="mt-[var(--mds-space-3)] text-center text-sm font-medium text-[var(--mds-color-action-primary)] sm:hidden">
            {step + 1} / {STEPS.length} — {STEPS[step]}
          </p>
        </div>
      </div>

      {/* Step content */}
      {step === 0 && (
        <OperationalCard title="بيانات المؤسسة">
          <div className="grid gap-[var(--mds-space-4)]">
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="invite-token">رمز دعوة المنصة</Label>
              <Input
                id="invite-token"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="الصق رمز الدعوة من منصة الإدارة"
              />
              <p className="text-xs text-muted-foreground">
                في بيئة الإنتاج رمز الدعوة إلزامي. محليًا يمكن تركه فاضي للتطوير/الديمو فقط.
              </p>
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label>اسم المؤسسة</Label>
              <Input
                value={organization.name}
                onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label>الشعار</Label>
              <Input type="file" accept="image/*" onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)} />
              {organization.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={organization.logoUrl} alt="معاينة الشعار" className="mt-[var(--mds-space-2)] h-16 w-16 rounded-[var(--mds-radius-md)] object-cover" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-[var(--mds-space-4)]">
              <div className="space-y-[var(--mds-space-2)]">
                <Label>العملة</Label>
                <Input
                  value={organization.currency}
                  onChange={(e) => setOrganization({ ...organization, currency: e.target.value })}
                />
              </div>
              <div className="space-y-[var(--mds-space-2)]">
                <Label>المنطقة الزمنية</Label>
                <Input
                  value={organization.timezone}
                  onChange={(e) => setOrganization({ ...organization, timezone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label>الدولة</Label>
              <Input
                value={organization.country}
                onChange={(e) => setOrganization({ ...organization, country: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-[var(--mds-space-4)]">
              <div className="space-y-[var(--mds-space-2)]">
                <Label>نسبة الضريبة (%)</Label>
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
              <div className="space-y-[var(--mds-space-2)]">
                <Label>طريقة الضريبة</Label>
                <label className="flex items-center gap-[var(--mds-space-2)] text-sm">
                  <Checkbox
                    checked={organization.taxInclusive}
                    onCheckedChange={(checked) =>
                      setOrganization({ ...organization, taxInclusive: checked === true })
                    }
                  />
                  الأسعار شاملة الضريبة
                </label>
                <label className="flex items-center gap-[var(--mds-space-2)] text-sm">
                  <Checkbox
                    checked={organization.taxEnabled}
                    onCheckedChange={(checked) =>
                      setOrganization({ ...organization, taxEnabled: checked === true })
                    }
                  />
                  تفعيل الضريبة
                </label>
              </div>
            </div>
          </div>
        </OperationalCard>
      )}

      {step === 1 && (
        <OperationalCard title="أول فرع">
          <div className="grid gap-[var(--mds-space-4)]">
            <div className="space-y-[var(--mds-space-2)]">
              <Label>اسم الفرع</Label>
              <Input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label>العنوان</Label>
              <Textarea value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label>الهاتف</Label>
              <Input value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label>المنطقة الزمنية للفرع</Label>
              <Input
                value={store.timezone}
                onChange={(e) => setStore({ ...store, timezone: e.target.value })}
              />
            </div>
          </div>
        </OperationalCard>
      )}

      {step === 2 && (
        <OperationalCard title="حساب المالك">
          <div className="grid gap-[var(--mds-space-4)]">
            <div className="space-y-[var(--mds-space-2)]">
              <Label>الاسم</Label>
              <Input value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                value={owner.email}
                readOnly={false}
                onChange={(e) => setOwner({ ...owner, email: e.target.value })}
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label>كلمة المرور</Label>
              <PasswordInput
                value={owner.password}
                onChange={(e) => setOwner({ ...owner, password: e.target.value })}
              />
            </div>
          </div>
        </OperationalCard>
      )}

      {step === 3 && (
        <OperationalCard title="نوع النشاط">
          <div className="grid gap-[var(--mds-space-3)] sm:grid-cols-2">
            {BUSINESS_ACTIVITY_TYPES.map((type) => (
              <label
                key={type}
                className={cn(
                  "flex cursor-pointer items-center gap-[var(--mds-space-3)] rounded-[var(--mds-radius-lg)] border p-[var(--mds-space-3)] text-sm font-medium transition-colors select-none",
                  businessType === type
                    ? "border-[var(--mds-color-action-primary)] bg-[var(--mds-color-action-primary)]/8 text-[var(--mds-color-action-primary)]"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <Checkbox
                  checked={businessType === type}
                  onCheckedChange={(checked) => {
                    if (checked === true) {
                      setBusinessType(type);
                      setFeatures(defaultOnboardingFeaturesForActivity(type));
                    }
                  }}
                />
                {BUSINESS_ACTIVITY_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
        </OperationalCard>
      )}

      {step === 4 && (
        <OperationalCard title="الخصائص">
          <div className="grid gap-[var(--mds-space-2)] sm:grid-cols-2">
            {ONBOARDING_FEATURE_KEYS.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] border border-transparent px-[var(--mds-space-2)] py-[var(--mds-space-2)] text-sm transition-colors select-none hover:bg-muted/50"
              >
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
        <OperationalCard title="الإعدادات الافتراضية">
          <div className="grid gap-[var(--mds-space-4)]">
            <div className="space-y-[var(--mds-space-2)]">
              <Label>بداية الإيصال</Label>
              <Textarea
                value={defaultSettings.receiptHeader}
                onChange={(e) =>
                  setDefaultSettings({ ...defaultSettings, receiptHeader: e.target.value })
                }
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label>نهاية الإيصال</Label>
              <Textarea
                value={defaultSettings.receiptFooter}
                onChange={(e) =>
                  setDefaultSettings({ ...defaultSettings, receiptFooter: e.target.value })
                }
              />
            </div>
            <div className="grid gap-[var(--mds-space-2)] sm:grid-cols-2">
              {(
                Object.keys(PAYMENT_METHOD_LABELS) as Array<keyof typeof PAYMENT_METHOD_LABELS>
              ).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] border border-transparent px-[var(--mds-space-2)] py-[var(--mds-space-2)] text-sm select-none hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={defaultSettings.paymentMethods[key]}
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
                  {PAYMENT_METHOD_LABELS[key]}
                </label>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-[var(--mds-space-2)] text-sm select-none">
              <Checkbox
                checked={defaultSettings.preventNegativeStock}
                onCheckedChange={(checked) =>
                  setDefaultSettings({
                    ...defaultSettings,
                    preventNegativeStock: checked === true,
                  })
                }
              />
              منع المخزون السالب
            </label>
            <div className="grid grid-cols-2 gap-[var(--mds-space-4)]">
              <div className="space-y-[var(--mds-space-2)]">
                <Label>أقصى ساعات فتح الجلسة</Label>
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
              <div className="space-y-[var(--mds-space-2)]">
                <Label>ساعات تحذير الجلسة</Label>
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
            <label className="flex cursor-pointer items-center gap-[var(--mds-space-2)] text-sm select-none">
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
        <OperationalCard title="التجهيز الأولي">
          <div className="grid gap-[var(--mds-space-3)]">
            <label className="flex cursor-pointer items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] border border-transparent px-[var(--mds-space-2)] py-[var(--mds-space-2)] text-sm select-none hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={initialSetup.createDefaultCostCenters}
                onCheckedChange={(checked) =>
                  setInitialSetup({ ...initialSetup, createDefaultCostCenters: checked === true })
                }
              />
              Create default cost centers
            </label>
            <label className="flex cursor-pointer items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] border border-transparent px-[var(--mds-space-2)] py-[var(--mds-space-2)] text-sm select-none hover:bg-muted/50 transition-colors">
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
            <label className="flex cursor-pointer items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] border border-transparent px-[var(--mds-space-2)] py-[var(--mds-space-2)] text-sm select-none hover:bg-muted/50 transition-colors">
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
            <label className="flex cursor-pointer items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] border border-transparent px-[var(--mds-space-2)] py-[var(--mds-space-2)] text-sm select-none hover:bg-muted/50 transition-colors">
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
            <label className="flex cursor-pointer items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] border border-transparent px-[var(--mds-space-2)] py-[var(--mds-space-2)] text-sm select-none hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={initialSetup.createFirstPosDevice}
                onCheckedChange={(checked) =>
                  setInitialSetup({ ...initialSetup, createFirstPosDevice: checked === true })
                }
              />
              Create first POS device placeholder
            </label>
            {initialSetup.createFirstPosDevice && (
              <div className="space-y-[var(--mds-space-2)] ps-[var(--mds-space-6)]">
                <Label>اسم جهاز الكاشير</Label>
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

      {/* Navigation */}
      <div className="flex justify-between gap-[var(--mds-space-3)]">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          disabled={step === 0 || pending}
          onClick={() => setStep(Math.max(step - 1, 0))}
        >
          السابق
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            className="h-10"
            onClick={nextStep}
            disabled={pending}
          >
            التالي
          </Button>
        ) : (
          <Button
            type="button"
            className="h-10"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "جاري التجهيز..." : "إكمال التجهيز"}
          </Button>
        )}
      </div>
    </div>
  );
}
