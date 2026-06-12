"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
      title="Barcode Labels"
      description="Print product stickers for thermal or A4 label sheets"
      actions={
        <Button
          variant="outline"
          disabled={selectedIds.length === 0}
          render={
            selectedIds.length ? (
              <a href={printHref} target="_blank" rel="noopener noreferrer" />
            ) : undefined
          }
        >
          <Printer className="me-2 size-4" />
          Print preview
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4 rounded-2xl border bg-card p-4">
          <div className="space-y-2">
            <Label>Preset</Label>
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thermal_40x30">Thermal 40×30mm</SelectItem>
                <SelectItem value="thermal_50x25">Thermal 50×25mm</SelectItem>
                <SelectItem value="a4_3x7">A4 sheet 63.5×38.1mm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Width (mm)</Label>
              <Input
                type="number"
                value={settings.labelWidthMm}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, labelWidthMm: Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Height (mm)</Label>
              <Input
                type="number"
                value={settings.labelHeightMm}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, labelHeightMm: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.showPrice}
              onChange={(e) => setSettings((s) => ({ ...s, showPrice: e.target.checked }))}
            />
            Show price
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.showSku}
              onChange={(e) => setSettings((s) => ({ ...s, showSku: e.target.checked }))}
            />
            Show SKU
          </label>
          <div className="space-y-2">
            <Label>Copies per product</Label>
            <Input value={copies} onChange={(e) => setCopies(e.target.value)} />
          </div>
          <Button
            className="w-full"
            onClick={async () => {
              try {
                await saveLabelSettingsAction(settings);
                toast.success("Label settings saved");
              } catch {
                toast.error("Could not save settings");
              }
            }}
          >
            Save settings
          </Button>
        </div>

        <div className="space-y-4">
          <Input
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-[320px] overflow-y-auto rounded-2xl border">
            {filtered.map((product) => {
              const checked = selectedIds.includes(product.id);
              return (
                <label
                  key={product.id}
                  className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0"
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
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="mb-3 text-sm font-medium">Preview</p>
              <LabelDocument items={labelItems} settings={settings} currency={currency} />
            </div>
          ) : null}
        </div>
      </div>
    </ReportPage>
  );
}
