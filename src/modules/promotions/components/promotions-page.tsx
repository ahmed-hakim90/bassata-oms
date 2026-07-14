"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { StandardModalContent } from "@/components/SweetFlow/standard-modal";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { PromotionRule, PromotionRuleType, PromotionScopeType } from "@/lib/types";
import {
  deletePromotionAction,
  togglePromotionAction,
  upsertPromotionAction,
} from "@/modules/promotions/actions/promotion.actions";

const RULE_TYPE_LABELS: Record<PromotionRuleType, string> = {
  percent_off_item: "خصم % على منتج/فئة",
  fixed_off_item: "خصم مبلغ على منتج",
  scheduled_sale_price: "سعر عرض مجدول",
  cart_percent: "خصم % على الفاتورة",
  cart_fixed: "خصم مبلغ على الفاتورة",
  bogo: "اشتري واحصل",
  qty_threshold: "خصم عند كمية",
};

type CatalogOption = { id: string; name: string; category_id?: string };

interface PromotionsPageProps {
  rules: PromotionRule[];
  categories: CatalogOption[];
  products: CatalogOption[];
}

type FormState = {
  id?: string;
  name: string;
  isActive: boolean;
  ruleType: PromotionRuleType;
  priority: string;
  startsAt: string;
  endsAt: string;
  couponCode: string;
  stackableWithCart: boolean;
  minSubtotal: string;
  scopeType: PromotionScopeType;
  scopeIds: string[];
  saleRetail: boolean;
  saleWholesale: boolean;
  usageLimitTotal: string;
  percent: string;
  amount: string;
  salePrice: string;
  buyQty: string;
  getQty: string;
  getPercent: string;
  minQty: string;
};

const emptyForm = (): FormState => ({
  name: "",
  isActive: true,
  ruleType: "percent_off_item",
  priority: "0",
  startsAt: "",
  endsAt: "",
  couponCode: "",
  stackableWithCart: false,
  minSubtotal: "0",
  scopeType: "all",
  scopeIds: [],
  saleRetail: true,
  saleWholesale: true,
  usageLimitTotal: "",
  percent: "10",
  amount: "10",
  salePrice: "",
  buyQty: "2",
  getQty: "1",
  getPercent: "100",
  minQty: "5",
});

function ruleToForm(rule: PromotionRule): FormState {
  return {
    id: rule.id,
    name: rule.name,
    isActive: rule.is_active,
    ruleType: rule.rule_type,
    priority: String(rule.priority),
    startsAt: rule.starts_at ? rule.starts_at.slice(0, 16) : "",
    endsAt: rule.ends_at ? rule.ends_at.slice(0, 16) : "",
    couponCode: rule.coupon_code ?? "",
    stackableWithCart: rule.stackable_with_cart,
    minSubtotal: String(rule.min_subtotal ?? 0),
    scopeType: rule.scope_type,
    scopeIds: rule.scope_ids,
    saleRetail: rule.sale_modes.includes("retail"),
    saleWholesale: rule.sale_modes.includes("wholesale"),
    usageLimitTotal: rule.usage_limit_total != null ? String(rule.usage_limit_total) : "",
    percent: String(rule.config.percent ?? 10),
    amount: String(rule.config.amount ?? 10),
    salePrice: String(rule.config.sale_price ?? ""),
    buyQty: String(rule.config.buy_qty ?? 2),
    getQty: String(rule.config.get_qty ?? 1),
    getPercent: String(rule.config.get_percent ?? 100),
    minQty: String(rule.config.min_qty ?? 5),
  };
}

function buildConfig(form: FormState): Record<string, number | undefined> {
  switch (form.ruleType) {
    case "percent_off_item":
    case "cart_percent":
      return { percent: parseFloat(form.percent) || 0 };
    case "fixed_off_item":
    case "cart_fixed":
      return { amount: parseFloat(form.amount) || 0 };
    case "scheduled_sale_price":
      return { sale_price: parseFloat(form.salePrice) || 0 };
    case "bogo":
      return {
        buy_qty: parseFloat(form.buyQty) || 0,
        get_qty: parseFloat(form.getQty) || 0,
        get_percent: parseFloat(form.getPercent) || 100,
      };
    case "qty_threshold":
      return {
        min_qty: parseFloat(form.minQty) || 0,
        percent: form.percent ? parseFloat(form.percent) : undefined,
        amount: form.amount && !form.percent ? parseFloat(form.amount) : undefined,
      };
    default:
      return {};
  }
}

export function PromotionsPage({ rules, categories, products }: PromotionsPageProps) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.coupon_code ?? "").toLowerCase().includes(q) ||
        RULE_TYPE_LABELS[r.rule_type].includes(q)
    );
  }, [rules, query]);

  const openCreate = () => {
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (rule: PromotionRule) => {
    setForm(ruleToForm(rule));
    setOpen(true);
  };

  const save = () => {
    startTransition(async () => {
      try {
        const saleModes: ("retail" | "wholesale")[] = [];
        if (form.saleRetail) saleModes.push("retail");
        if (form.saleWholesale) saleModes.push("wholesale");
        if (saleModes.length === 0) throw new Error("اختار وضع بيع واحد على الأقل");

        await upsertPromotionAction({
          id: form.id,
          name: form.name,
          isActive: form.isActive,
          ruleType: form.ruleType,
          priority: parseInt(form.priority, 10) || 0,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          couponCode: form.couponCode || null,
          stackableWithCart: form.stackableWithCart,
          minSubtotal: parseFloat(form.minSubtotal) || 0,
          scopeType: form.scopeType,
          scopeIds: form.scopeIds,
          saleModes,
          config: buildConfig(form),
          usageLimitTotal: form.usageLimitTotal ? parseInt(form.usageLimitTotal, 10) : null,
        });
        toast.success(form.id ? "تم تحديث العرض" : "تم إنشاء العرض");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "فشل حفظ العرض");
      }
    });
  };

  const toggle = (rule: PromotionRule) => {
    startTransition(async () => {
      try {
        await togglePromotionAction(rule.id, !rule.is_active);
        toast.success(rule.is_active ? "العرض اتوقف" : "العرض اتفعّل");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "فشل التحديث");
      }
    });
  };

  const remove = (rule: PromotionRule) => {
    if (!confirm(`حذف العرض «${rule.name}»؟`)) return;
    startTransition(async () => {
      try {
        await deletePromotionAction(rule.id);
        toast.success("تم حذف العرض");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "فشل الحذف");
      }
    });
  };

  const scopeOptions = form.scopeType === "category" ? categories : products;
  const showItemScope =
    form.ruleType === "percent_off_item" ||
    form.ruleType === "fixed_off_item" ||
    form.ruleType === "scheduled_sale_price" ||
    form.ruleType === "bogo" ||
    form.ruleType === "qty_threshold";
  const showCartFields =
    form.ruleType === "cart_percent" || form.ruleType === "cart_fixed";

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]" dir="rtl">
      <PageHeader
        title="العروض"
        description="قواعد خصم تلقائية وكوبونات بتشتغل على الكاشير والمنيو وفواتير الجملة"
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            عرض جديد
          </Button>
        }
      />

      <OperationalCard title="قائمة العروض">
        <div className="mb-4">
          <Input
            placeholder="ابحث بالاسم أو الكود…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="بحث العروض"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyStateBlock
            title="مفيش عروض"
            description="إنشئ عرض نسبة أو مبلغ أو كوبون أو اشتري واحصل"
            action={
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                عرض جديد
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{rule.name}</span>
                    <Badge variant={rule.is_active ? "default" : "secondary"}>
                      {rule.is_active ? "مفعّل" : "متوقف"}
                    </Badge>
                    <Badge variant="outline">{RULE_TYPE_LABELS[rule.rule_type]}</Badge>
                    {rule.coupon_code ? (
                      <Badge variant="outline">كود: {rule.coupon_code}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    أولوية {rule.priority}
                    {rule.starts_at || rule.ends_at
                      ? ` · من ${rule.starts_at ? new Date(rule.starts_at).toLocaleString("ar-EG") : "—"} إلى ${rule.ends_at ? new Date(rule.ends_at).toLocaleString("ar-EG") : "—"}`
                      : ""}
                    {rule.usage_limit_total != null
                      ? ` · استخدام ${rule.usage_count}/${rule.usage_limit_total}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(rule)} disabled={pending}>
                    <Pencil className="size-3.5" />
                    تعديل
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggle(rule)} disabled={pending}>
                    <Power className="size-3.5" />
                    {rule.is_active ? "إيقاف" : "تفعيل"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(rule)} disabled={pending}>
                    حذف
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </OperationalCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <StandardModalContent
          size="lg"
          title={form.id ? "تعديل عرض" : "عرض جديد"}
          description="حدد النوع والنطاق والجدولة — الحساب النهائي بيحصل في السيرفر"
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                إلغاء
              </Button>
              <Button onClick={save} disabled={pending}>
                حفظ
              </Button>
            </>
          }
        >
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto pe-1">
          <div className="grid gap-2">
            <Label htmlFor="promo-name">الاسم</Label>
            <Input
              id="promo-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label>نوع العرض</Label>
            <Select
              value={form.ruleType}
              onValueChange={(v) => setForm({ ...form, ruleType: v as PromotionRuleType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RULE_TYPE_LABELS) as PromotionRuleType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {RULE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(form.ruleType === "percent_off_item" ||
            form.ruleType === "cart_percent" ||
            form.ruleType === "qty_threshold") && (
            <div className="grid gap-2">
              <Label htmlFor="promo-pct">نسبة الخصم %</Label>
              <Input
                id="promo-pct"
                type="number"
                min={0}
                max={100}
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: e.target.value })}
              />
            </div>
          )}

          {(form.ruleType === "fixed_off_item" ||
            form.ruleType === "cart_fixed" ||
            form.ruleType === "qty_threshold") && (
            <div className="grid gap-2">
              <Label htmlFor="promo-amt">مبلغ الخصم</Label>
              <Input
                id="promo-amt"
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          )}

          {form.ruleType === "scheduled_sale_price" && (
            <div className="grid gap-2">
              <Label htmlFor="promo-sale">سعر العرض</Label>
              <Input
                id="promo-sale"
                type="number"
                min={0}
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
              />
            </div>
          )}

          {form.ruleType === "bogo" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>اشتري</Label>
                <Input
                  type="number"
                  value={form.buyQty}
                  onChange={(e) => setForm({ ...form, buyQty: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>احصل</Label>
                <Input
                  type="number"
                  value={form.getQty}
                  onChange={(e) => setForm({ ...form, getQty: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>خصم %</Label>
                <Input
                  type="number"
                  value={form.getPercent}
                  onChange={(e) => setForm({ ...form, getPercent: e.target.value })}
                />
              </div>
            </div>
          )}

          {form.ruleType === "qty_threshold" && (
            <div className="grid gap-2">
              <Label>الحد الأدنى للكمية</Label>
              <Input
                type="number"
                value={form.minQty}
                onChange={(e) => setForm({ ...form, minQty: e.target.value })}
              />
            </div>
          )}

          {showCartFields && (
            <div className="grid gap-2">
              <Label>حد أدنى للإجمالي</Label>
              <Input
                type="number"
                value={form.minSubtotal}
                onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })}
              />
            </div>
          )}

          {showItemScope && (
            <>
              <div className="grid gap-2">
                <Label>النطاق</Label>
                <Select
                  value={form.scopeType}
                  onValueChange={(v) =>
                    setForm({ ...form, scopeType: v as PromotionScopeType, scopeIds: [] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأصناف</SelectItem>
                    <SelectItem value="product">منتجات محددة</SelectItem>
                    <SelectItem value="category">فئات محددة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.scopeType !== "all" && (
                <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border p-2">
                  {scopeOptions.map((opt) => {
                    const checked = form.scopeIds.includes(opt.id);
                    return (
                      <label key={opt.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v === true
                              ? [...form.scopeIds, opt.id]
                              : form.scopeIds.filter((id) => id !== opt.id);
                            setForm({ ...form, scopeIds: next });
                          }}
                        />
                        {opt.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>من</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>إلى</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="promo-code">كود خصم (اختياري)</Label>
            <Input
              id="promo-code"
              value={form.couponCode}
              onChange={(e) => setForm({ ...form, couponCode: e.target.value })}
              placeholder="مثال: SAVE10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>أولوية</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>حد استخدام الكود</Label>
              <Input
                type="number"
                value={form.usageLimitTotal}
                onChange={(e) => setForm({ ...form, usageLimitTotal: e.target.value })}
                placeholder="بدون حد"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.saleRetail}
                onCheckedChange={(v) => setForm({ ...form, saleRetail: v === true })}
              />
              تجزئة
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.saleWholesale}
                onCheckedChange={(v) => setForm({ ...form, saleWholesale: v === true })}
              />
              جملة
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.stackableWithCart}
                onCheckedChange={(v) => setForm({ ...form, stackableWithCart: v === true })}
              />
              يسمح بتستيف مع خصم آخر
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v === true })}
              />
              مفعّل
            </label>
          </div>
        </div>
        </StandardModalContent>
      </Dialog>
    </div>
  );
}
