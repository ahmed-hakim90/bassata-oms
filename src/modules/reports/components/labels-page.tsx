"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { Product } from "@/lib/types";
import {
  LABEL_PRESETS,
  type LabelSettings,
} from "@/modules/reports/labels/label-settings";
import { saveLabelSettingsAction } from "@/modules/reports/actions/label.actions";
import { toast } from "sonner";

interface LabelsPageProps {
  products: Product[];
  currency: string;
  initialSettings: LabelSettings;
}

export function LabelsPage({ products, currency, initialSettings }: LabelsPageProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copies, setCopies] = useState(String(initialSettings.defaultCopies));
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
    );
  }, [products, query]);

  const labelItems = selectedIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p))
    .map((p) => ({
      id: p.id,
      productName: p.name,
      barcode: p.barcode || p.sku,
      sku: p.sku,
      price: p.sale_price ?? p.base_price,
      copies: Number(copies) || settings.defaultCopies,
    }));

  const printHref = `/print/labels?ids=${selectedIds.join(",")}&copies=${copies}`;

  return (
    <ReportPage
      title="ملصقات الباركود"
      description="اطبع ملصقات المنتجات للطابعة الحرارية أو ورق A4"
      actions={
        <Button
          variant="outline"
          className="shadow-[var(--mds-elevation-1)]"
          disabled={selectedIds.length === 0}
          render={
            selectedIds.length ? (
              <a href={printHref} target="_blank" rel="noopener noreferrer" />
            ) : undefined
          }
        >
          <Printer className="me-2 size-4" />
          معاينة الطباعة
        </Button>
      }
    >
      <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-[320px_1fr]">
        <div className="space-y-[var(--mds-space-4)] rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)]">
          <div className="space-y-[var(--mds-space-2)]">
            <Label>مقاس جاهز</Label>
            <Select
              value={settings.preset}
              onValueChange={(preset) => {
                const next = {
                  preset: preset as LabelSettings["preset"],
                  ...LABEL_PRESETS[preset as LabelSettings["preset"]],
                };
                setSettings(next);
              }}
            >
              <SelectTrigger className="rounded-[var(--mds-radius-md)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thermal_40x30">حراري 40×30مم</SelectItem>
                <SelectItem value="thermal_50x25">حراري 50×25مم</SelectItem>
                <SelectItem value="a4_3x7">ورقة A4 63.5×38.1مم</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-[var(--mds-space-3)]">
            <div className="space-y-[var(--mds-space-2)]">
              <Label>العرض (مم)</Label>
              <Input
                type="number"
                value={settings.labelWidthMm}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, labelWidthMm: Number(e.target.value) }))
                }
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label>الارتفاع (مم)</Label>
              <Input
                type="number"
                value={settings.labelHeightMm}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, labelHeightMm: Number(e.target.value) }))
                }
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
          </div>
          <label className="flex items-center gap-[var(--mds-space-2)] text-sm">
            <input
              type="checkbox"
              checked={settings.showPrice}
              onChange={(e) => setSettings((s) => ({ ...s, showPrice: e.target.checked }))}
            />
            إظهار السعر
          </label>
          <label className="flex items-center gap-[var(--mds-space-2)] text-sm">
            <input
              type="checkbox"
              checked={settings.showSku}
              onChange={(e) => setSettings((s) => ({ ...s, showSku: e.target.checked }))}
            />
            إظهار SKU
          </label>
          <div className="space-y-[var(--mds-space-2)]">
            <Label>عدد النسخ لكل منتج</Label>
            <Input
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
              className="rounded-[var(--mds-radius-md)]"
            />
          </div>
          <Button
            className="w-full shadow-[var(--mds-elevation-1)]"
            onClick={async () => {
              try {
                await saveLabelSettingsAction(settings);
                toast.success("تم حفظ إعدادات الملصقات");
              } catch {
                toast.error("تعذر حفظ الإعدادات");
              }
            }}
          >
            حفظ الإعدادات
          </Button>
        </div>

        <div className="space-y-[var(--mds-space-4)]">
          <Input
            placeholder="ابحث عن منتج…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="بحث المنتجات"
            className="rounded-[var(--mds-radius-md)]"
          />
          <div className="max-h-[320px] overflow-y-auto rounded-[var(--mds-radius-lg)] border border-border shadow-[var(--mds-elevation-1)]">
            {filtered.map((product) => {
              const checked = selectedIds.includes(product.id);
              return (
                <label
                  key={product.id}
                  className="flex cursor-pointer items-center gap-[var(--mds-space-3)] border-b border-border px-[var(--mds-space-4)] py-[var(--mds-space-3)] last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedIds((ids) =>
                        checked ? ids.filter((id) => id !== product.id) : [...ids, product.id]
                      )
                    }
                  />
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku} · {product.barcode}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          {labelItems.length > 0 ? (
            <div className="rounded-[var(--mds-radius-lg)] border border-border bg-muted/20 p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)]">
              <p className="mb-[var(--mds-space-3)] text-sm font-medium">معاينة</p>
              <LabelDocument items={labelItems} settings={settings} currency={currency} />
            </div>
          ) : null}
        </div>
      </div>
    </ReportPage>
  );
}
