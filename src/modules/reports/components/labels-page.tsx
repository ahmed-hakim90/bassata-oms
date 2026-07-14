"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Minus,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportPage } from "@/modules/reports/components/report-page";
import { LabelDocument } from "@/modules/reports/labels/label-document";
import {
  LABEL_PRESET_OPTIONS,
  applyPreset,
  type LabelSettings,
} from "@/modules/reports/labels/label-settings";
import {
  buildLabelPrintJob,
  getLabelPrintBlockers,
  type LabelPrintItem,
  type LabelStudioProduct,
} from "@/modules/reports/labels/print-job";
import { saveLabelPrintJob } from "@/modules/reports/labels/print-payload";
import { saveLabelSettingsAction } from "@/modules/reports/actions/label.actions";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, Product, ProductVariant } from "@/lib/types";

interface LabelsPageProps {
  products: LabelStudioProduct[];
  categories: Category[];
  currency: string;
  initialSettings: LabelSettings;
}

type CartLine = LabelPrintItem;

function cartLineId(productId: string, variantId?: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

function resolvePrice(product: Product, variant?: ProductVariant | null): number | null {
  if (variant) {
    if (variant.price != null) return variant.price;
    if (variant.fixed_price != null) return variant.fixed_price;
    return (product.sale_price ?? product.base_price) + (variant.price_delta || 0);
  }
  return product.sale_price ?? product.base_price;
}

function buildCartLine(
  product: LabelStudioProduct,
  variant: ProductVariant | null,
  copies: number
): CartLine {
  const barcode = (variant?.barcode || product.barcode || "").trim();
  const sku = (variant?.sku || product.sku || "").trim();
  return {
    id: cartLineId(product.id, variant?.id),
    productId: product.id,
    variantId: variant?.id ?? null,
    productName: product.name,
    variantName: variant?.name ?? null,
    barcode,
    sku,
    price: resolvePrice(product, variant),
    copies: Math.max(1, copies),
  };
}

function ContentToggle({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-[var(--mds-space-2)] text-sm"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <span>{label}</span>
    </label>
  );
}

function WarningBadges({
  barcode,
  sku,
}: {
  barcode: string;
  sku: string;
}) {
  if (barcode.trim() && sku.trim()) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {!barcode.trim() ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
          <AlertTriangle className="size-3" aria-hidden />
          بدون Barcode
        </span>
      ) : null}
      {!sku.trim() ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
          <AlertTriangle className="size-3" aria-hidden />
          بدون SKU
        </span>
      ) : null}
    </div>
  );
}

export function LabelsPage({
  products,
  categories,
  currency,
  initialSettings,
}: LabelsPageProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId !== "all" && p.category_id !== categoryId) return false;
      if (!q) return true;
      const inProduct =
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q);
      const inVariant = p.variants.some(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          v.barcode.toLowerCase().includes(q)
      );
      return inProduct || inVariant;
    });
  }, [products, query, categoryId]);

  const printJob = useMemo(
    () => buildLabelPrintJob({ currency, items: cart, settings }),
    [currency, cart, settings]
  );

  const blockers = useMemo(
    () => getLabelPrintBlockers(cart, settings),
    [cart, settings]
  );

  const blockingBarcodes = blockers.filter((b) => b.reason === "missing_barcode");
  const productCount = cart.length;
  const labelCount = cart.reduce((sum, line) => sum + line.copies, 0);
  const canPrint = cart.length > 0 && blockingBarcodes.length === 0;

  const addToCart = (product: LabelStudioProduct, variant: ProductVariant | null) => {
    const id = cartLineId(product.id, variant?.id);
    setCart((prev) => {
      const existing = prev.find((line) => line.id === id);
      if (existing) {
        return prev.map((line) =>
          line.id === id ? { ...line, copies: line.copies + 1 } : line
        );
      }
      return [...prev, buildCartLine(product, variant, settings.defaultCopies)];
    });
  };

  const setCopies = (id: string, copies: number) => {
    setCart((prev) =>
      prev.map((line) =>
        line.id === id ? { ...line, copies: Math.max(1, Math.floor(copies) || 1) } : line
      )
    );
  };

  const removeLine = (id: string) => {
    setCart((prev) => prev.filter((line) => line.id !== id));
  };

  const openPrint = () => {
    if (!canPrint) return;
    const job = buildLabelPrintJob({ currency, items: cart, settings });
    saveLabelPrintJob(job);
    const printWindow = window.open("/print/labels", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast.error("المتصفح منع فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة");
    }
  };

  const saveDefaults = async () => {
    setSaving(true);
    try {
      await saveLabelSettingsAction(settings);
      toast.success("تم حفظ الإعدادات الافتراضية");
    } catch {
      toast.error("تعذر حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReportPage
      title="ملصقات الباركود"
      description="اختَر المنتجات، عدّل المحتوى، والطابعة هتطبّع نفس المعاينة"
      actions={
        <Button
          variant="outline"
          className="shadow-[var(--mds-elevation-1)]"
          disabled={!canPrint}
          onClick={openPrint}
        >
          <Printer className="me-2 size-4" />
          معاينة الطباعة
        </Button>
      }
    >
      <div className="grid gap-[var(--mds-space-6)] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* Settings */}
        <aside className="space-y-[var(--mds-space-4)] rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)]">
          <div className="space-y-[var(--mds-space-2)]">
            <Label>مقاس الملصق</Label>
            <Select
              value={settings.preset}
              onValueChange={(preset) => {
                if (!preset) return;
                setSettings((prev) => applyPreset(preset as LabelSettings["preset"], prev));
              }}
            >
              <SelectTrigger className="rounded-[var(--mds-radius-md)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABEL_PRESET_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {settings.preset === "custom" ? (
            <div className="grid grid-cols-2 gap-[var(--mds-space-3)]">
              <div className="space-y-[var(--mds-space-2)]">
                <Label>العرض (مم)</Label>
                <Input
                  type="number"
                  min={20}
                  max={120}
                  value={settings.labelWidthMm}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      preset: "custom",
                      labelWidthMm: Number(e.target.value) || s.labelWidthMm,
                    }))
                  }
                  className="rounded-[var(--mds-radius-md)]"
                />
              </div>
              <div className="space-y-[var(--mds-space-2)]">
                <Label>الارتفاع (مم)</Label>
                <Input
                  type="number"
                  min={15}
                  max={120}
                  value={settings.labelHeightMm}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      preset: "custom",
                      labelHeightMm: Number(e.target.value) || s.labelHeightMm,
                    }))
                  }
                  className="rounded-[var(--mds-radius-md)]"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {settings.labelWidthMm}×{settings.labelHeightMm} مم — خط تلقائي
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSettings((prev) => applyPreset("custom", prev))}
              >
                مقاس مخصص
              </Button>
            </div>
          )}

          <div className="space-y-[var(--mds-space-3)] border-t border-border pt-[var(--mds-space-4)]">
            <p className="text-sm font-medium">محتوى الملصق</p>
            <ContentToggle
              id="show-name"
              label="اسم المنتج"
              checked={settings.showName}
              onCheckedChange={(showName) => setSettings((s) => ({ ...s, showName }))}
            />
            <ContentToggle
              id="show-variant"
              label="اسم المتغير"
              checked={settings.showVariant}
              onCheckedChange={(showVariant) => setSettings((s) => ({ ...s, showVariant }))}
            />
            <ContentToggle
              id="show-price"
              label="السعر"
              checked={settings.showPrice}
              onCheckedChange={(showPrice) => setSettings((s) => ({ ...s, showPrice }))}
            />
            <ContentToggle
              id="show-sku"
              label="SKU"
              checked={settings.showSku}
              onCheckedChange={(showSku) => setSettings((s) => ({ ...s, showSku }))}
            />
            <ContentToggle
              id="show-barcode"
              label="الباركود"
              checked={settings.showBarcode}
              onCheckedChange={(showBarcode) => setSettings((s) => ({ ...s, showBarcode }))}
            />
            <ContentToggle
              id="show-barcode-number"
              label="رقم الباركود"
              checked={settings.showBarcodeNumber}
              onCheckedChange={(showBarcodeNumber) =>
                setSettings((s) => ({ ...s, showBarcodeNumber }))
              }
            />
          </div>

          <div className="space-y-[var(--mds-space-2)] border-t border-border pt-[var(--mds-space-4)]">
            <Label htmlFor="default-copies">النسخ الافتراضي لكل إضافة</Label>
            <Input
              id="default-copies"
              type="number"
              min={1}
              max={999}
              value={settings.defaultCopies}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  defaultCopies: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                }))
              }
              className="rounded-[var(--mds-radius-md)]"
            />
          </div>

          <Button
            variant="secondary"
            className="w-full"
            disabled={saving}
            onClick={() => void saveDefaults()}
          >
            حفظ كافتراضي
          </Button>
        </aside>

        {/* Catalog */}
        <section className="space-y-[var(--mds-space-4)]">
          <div className="grid gap-[var(--mds-space-3)] sm:grid-cols-[1fr_200px]">
            <Input
              placeholder="ابحث بالاسم أو SKU أو الباركود…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="بحث المنتجات"
              className="rounded-[var(--mds-radius-md)]"
            />
            <Select
              value={categoryId}
              onValueChange={(value) => setCategoryId(value || "all")}
            >
              <SelectTrigger className="rounded-[var(--mds-radius-md)]" aria-label="تصفية التصنيف">
                <SelectValue placeholder="كل التصنيفات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-[min(520px,55vh)] overflow-y-auto rounded-[var(--mds-radius-lg)] border border-border bg-card shadow-[var(--mds-elevation-1)]">
            {filtered.length === 0 ? (
              <div className="grid place-items-center p-[var(--mds-space-8)] text-sm text-muted-foreground">
                مفيش منتجات مطابقة للبحث
              </div>
            ) : (
              filtered.map((product) => {
                const activeVariants = product.variants.filter((v) => v.is_active);
                const categoryLabel = categoryNameById.get(product.category_id);
                return (
                  <div
                    key={product.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <div className="flex items-start gap-[var(--mds-space-3)] px-[var(--mds-space-4)] py-[var(--mds-space-3)]">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[product.sku || "—", product.barcode || "—", categoryLabel]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <WarningBadges barcode={product.barcode} sku={product.sku} />
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="shrink-0"
                        aria-label={`إضافة ${product.name}`}
                        onClick={() => addToCart(product, null)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    {activeVariants.length > 0
                      ? activeVariants.map((variant) => (
                          <div
                            key={variant.id}
                            className="flex items-start gap-[var(--mds-space-3)] border-t border-border/60 bg-muted/20 px-[var(--mds-space-4)] py-[var(--mds-space-2)] ps-10"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{variant.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(variant.sku || "—") + " · " + (variant.barcode || "—")}
                              </p>
                              <WarningBadges barcode={variant.barcode} sku={variant.sku} />
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="shrink-0"
                              aria-label={`إضافة ${variant.name}`}
                              onClick={() => addToCart(product, variant)}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </div>
                        ))
                      : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Cart */}
        <aside className="flex min-h-[320px] flex-col rounded-[var(--mds-radius-lg)] border border-border bg-card shadow-[var(--mds-elevation-1)]">
          <div className="border-b border-border px-[var(--mds-space-4)] py-[var(--mds-space-3)]">
            <p className="font-medium">سلة الطباعة</p>
            <p className="text-xs text-muted-foreground">كمية مستقلة لكل منتج</p>
          </div>

          <div className="flex-1 space-y-[var(--mds-space-2)] overflow-y-auto p-[var(--mds-space-3)]">
            {cart.length === 0 ? (
              <div className="grid h-full min-h-[160px] place-items-center text-center text-sm text-muted-foreground">
                اضغط + من الكتالوج لإضافة منتجات
              </div>
            ) : (
              cart.map((line) => (
                <div
                  key={line.id}
                  className="rounded-[var(--mds-radius-md)] border border-border p-[var(--mds-space-3)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{line.productName}</p>
                      {line.variantName ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {line.variantName}
                        </p>
                      ) : null}
                      {settings.showPrice && line.price != null ? (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(line.price, currency)}
                        </p>
                      ) : null}
                      <WarningBadges barcode={line.barcode} sku={line.sku} />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="حذف"
                      onClick={() => removeLine(line.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="تقليل الكمية"
                      onClick={() => setCopies(line.id, line.copies - 1)}
                      disabled={line.copies <= 1}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={999}
                      value={line.copies}
                      onChange={(e) => setCopies(line.id, Number(e.target.value))}
                      className="h-9 w-16 text-center rounded-[var(--mds-radius-md)]"
                      aria-label={`عدد نسخ ${line.productName}`}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="زيادة الكمية"
                      onClick={() => setCopies(line.id, line.copies + 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-[var(--mds-space-3)] border-t border-border p-[var(--mds-space-4)]">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المنتجات</span>
              <span className="font-medium tabular-nums">{productCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">إجمالي الملصقات</span>
              <span className="font-semibold tabular-nums">{labelCount}</span>
            </div>

            {blockingBarcodes.length > 0 ? (
              <div
                role="status"
                className="rounded-[var(--mds-radius-md)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100"
              >
                الطباعة متوقفة — فيه منتجات بدون باركود وظاهر «الباركود»:
                <ul className="mt-1 list-disc pe-4">
                  {blockingBarcodes.slice(0, 5).map((b) => (
                    <li key={b.id}>{b.productName}</li>
                  ))}
                  {blockingBarcodes.length > 5 ? (
                    <li>و {blockingBarcodes.length - 5} تانيين</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <Button className="w-full" disabled={!canPrint} onClick={openPrint}>
              <Printer className="me-2 size-4" />
              طباعة الملصقات
            </Button>
          </div>
        </aside>
      </div>

      {/* Live preview */}
      <div
        className={cn(
          "rounded-[var(--mds-radius-lg)] border border-border bg-muted/20 p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)]",
          cart.length === 0 && "opacity-70"
        )}
      >
        <div className="mb-[var(--mds-space-3)] flex items-center justify-between gap-3">
          <p className="text-sm font-medium">معاينة مباشرة</p>
          <p className="text-xs text-muted-foreground">
            أي تغيير في المحتوى أو المقاس أو الكميات يتظبط هنا فورًا
          </p>
        </div>
        {cart.length === 0 ? (
          <div className="grid place-items-center py-10 text-sm text-muted-foreground">
            المعاينة هتظهر بعد إضافة منتجات للسلة
          </div>
        ) : (
          <div className="max-h-[420px] overflow-auto rounded-md bg-white p-3">
            <LabelDocument job={printJob} preview />
          </div>
        )}
      </div>
    </ReportPage>
  );
}
